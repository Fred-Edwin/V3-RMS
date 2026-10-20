import { createHash } from 'node:crypto';
import { z } from 'zod';
import { logger } from '../../../utils/logger';
import { runAudited } from '../_shared/audit/audit-writer';
import { KIND_INFO, isWellFormedNumber, kindOfSlug, readableKindsOf, type DocumentKind } from '../_shared/documents/document-kinds';
import { documentsRepository } from '../_shared/documents/documents-repository';
import { hitLimit } from '../_shared/limits/rate-limit';
import type { AccessSubject } from '../_shared/workforce-access';
import { VERIFY_MISS_FRESH_MS, reconcileIfStale } from '../documents/reconcile';
import { notifyMany } from '../notifications';
import { employeesRepository } from '../people/employees/employees-repository';
import { resolveActor } from '../people/people-context';
import { answerFor, bare, matchVersion, type PublicAnswer, type RecordedOutcome } from './verify-outcome';
import { verifyRepository } from './verify-repository';

export const VERIFY_PER_MINUTE = 30;
export const VERIFY_PER_DAY = 300;
export const VERIFY_GLOBAL_PER_MINUTE = 600;

export const verifyParams = z.object({ kind: z.string().max(8), number: z.string().max(32) }).strict();
export const verifyQuery = z.object({ h: z.string().max(40).optional() }).passthrough();

export interface CheckerContext {
  address: string;
  deviceLabel: string | null;
}

const addressHash = (address: string): string => createHash('sha256').update(`verify:${address}`).digest('hex').slice(0, 32);

async function overLimit(address: string, now: number): Promise<boolean> {
  const a = addressHash(address);
  const [perMinute, perDay, global] = await Promise.all([
    hitLimit(`verify:m:${a}`, VERIFY_PER_MINUTE, 60, now),
    hitLimit(`verify:d:${a}`, VERIFY_PER_DAY, 86_400, now),
    hitLimit('verify:global', VERIFY_GLOBAL_PER_MINUTE, 60, now),
  ]);
  return !perMinute.allowed || !perDay.allowed || !global.allowed;
}

async function record(kind: string, number: string, outcome: RecordedOutcome, who: CheckerContext, userId: string | null): Promise<void> {
  try {
    await verifyRepository.record({ kind, number: number.slice(0, 32), outcome, addressHash: addressHash(who.address), deviceLabel: who.deviceLabel, userId });
  } catch (error) {
    logger.warn({ err: error }, 'a document check could not be counted');
  }
}

export interface Checked {
  answer: PublicAnswer;
  recorded: RecordedOutcome;
  row: Awaited<ReturnType<typeof documentsRepository.byNumber>>[number] | null;
}

/**
 * The check itself (6c D3). Always does the lookup and the compare, so an unknown number and a wrong hash take the same path and give
 * the same answer. Returns the stored row only for the signed-in variant; the public answer carries role and date only.
 */
export async function checkDocument(kindSlug: string, rawNumber: string, h: string | undefined, who: CheckerContext, now: Date = new Date()): Promise<Checked> {
  const kind: DocumentKind | null = kindOfSlug(kindSlug);
  const number = rawNumber.toUpperCase();
  if (await overLimit(who.address, now.getTime())) return { answer: bare('RATE_LIMITED', now), recorded: 'RATE_LIMITED', row: null };
  if (!kind || !isWellFormedNumber(kind, number) || !h || !/^[0-9a-f]{10}$/.test(h)) {
    await record(kind ?? 'XX', number, 'MALFORMED', who, null);
    return { answer: bare('MALFORMED', now), recorded: 'MALFORMED', row: null };
  }
  let rows = await documentsRepository.byNumber(kind, number);
  if (!matchVersion(rows, h)) {
    await reconcileIfStale(VERIFY_MISS_FRESH_MS);
    rows = await documentsRepository.byNumber(kind, number);
  }
  const hit = matchVersion(rows, h);
  if (!hit) {
    const recorded: RecordedOutcome = rows.length > 0 ? 'HASH_MISMATCH' : 'UNKNOWN';
    await record(kind, number, recorded, who, null);
    return { answer: bare('NOT_VERIFIED', now), recorded, row: rows[0] ?? null };
  }
  const { answer, recorded } = answerFor(hit, now);
  await record(kind, number, recorded, who, null);
  return { answer, recorded, row: hit };
}

/** At most one `document.verify_failed` per number per day, for a number that exists. Best effort; never changes the answer. */
export async function noteFailedCheck(row: NonNullable<Checked['row']>, now: Date): Promise<void> {
  const day = now.toISOString().slice(0, 10);
  if (!(await hitLimit(`verify-failed:${row.number}:${day}`, 1, 86_400, now.getTime())).allowed) return;
  try {
    await runAudited<void>(async () => ({
      result: undefined,
      entries: [{ companyId: row.companyId, siteId: row.siteId, actor: { id: null, role: 'SYSTEM', name: 'The system' }, channel: 'SYSTEM', action: 'document.verify_failed', category: 'SECURITY', subjectType: 'Document', subjectId: row.number, after: { number: row.number, kind: row.kind } }],
    }));
  } catch (error) {
    logger.warn({ err: error }, 'a failed document check could not be written');
  }
}

export interface SignedInAnswer extends PublicAnswer {
  signedBy: { name: string; role: string } | null;
  canOpen: boolean;
  openHref: string | null;
  readableBy: string[];
}

/** Signed in: the same verdict plus the signer's name and the Open button for a person who may read the type. */
export async function checkSignedIn(subject: AccessSubject, kindSlug: string, number: string, h: string | undefined, who: CheckerContext, now: Date = new Date()): Promise<SignedInAnswer> {
  const checked = await checkDocument(kindSlug, number, h, who, now);
  const kind = kindOfSlug(kindSlug);
  const row = checked.row;
  if (checked.recorded === 'HASH_MISMATCH' && row) await noteFailedCheck(row, now);
  const info = kind ? KIND_INFO[kind] : null;
  const matched = checked.answer.outcome !== 'NOT_VERIFIED' && checked.answer.outcome !== 'MALFORMED' && checked.answer.outcome !== 'RATE_LIMITED';
  const canOpen = matched && row !== null && readableKindsOf(subject).some((k) => k.kind === row.kind && (k.siteId === null || k.siteId === row.siteId));
  if (matched && row) {
    try {
      const ctx = await resolveActor(subject);
      await runAudited<void>(async () => ({
        result: undefined,
        entries: [{ companyId: ctx.companyId, siteId: subject.siteId ?? null, actor: ctx.auditActor, action: 'document.verified', category: 'DOCUMENTS', subjectType: 'Document', subjectId: row.number, after: { number: row.number, version: row.version, outcome: checked.recorded } }],
      }));
    } catch (error) {
      logger.warn({ err: error }, 'a signed-in document check could not be written');
    }
  }
  return { ...checked.answer, signedBy: canOpen && row ? { name: row.signedByName, role: row.signedByRole } : null, canOpen, openHref: canOpen && row ? row.openHref : null, readableBy: info ? [...info.readableBy] : [] };
}

export const reportBody = z.object({ h: z.string().regex(/^[0-9a-f]{10}$/), idempotencyKey: z.string().min(8).max(80) }).strict();

/** "Tell the {role}": a signed-in person says a printed copy does not match. Once per person, number and day. */
export async function reportMismatch(subject: AccessSubject, kindSlug: string, rawNumber: string, body: z.infer<typeof reportBody>, now: Date = new Date()): Promise<{ told: boolean; role: string }> {
  const kind = kindOfSlug(kindSlug);
  const number = rawNumber.toUpperCase();
  if (!kind || !isWellFormedNumber(kind, number)) return { told: false, role: '' };
  const ctx = await resolveActor(subject);
  const rows = await documentsRepository.byNumber(kind, number);
  const row = rows.find((r) => r.companyId === ctx.companyId) ?? null;
  const issuer = KIND_INFO[kind].issuerRole;
  const first = await hitLimit(`verify-report:${subject.id}:${number}:${now.toISOString().slice(0, 10)}`, 1, 86_400, now.getTime());
  if (!first.allowed) return { told: true, role: issuer };
  await runAudited<void>(async () => ({
    result: undefined,
    entries: [{ companyId: ctx.companyId, siteId: row?.siteId ?? null, actor: ctx.auditActor, action: 'document.mismatch_reported', category: 'SECURITY', subjectType: 'Document', subjectId: number, after: { number, kind } }],
  }));
  const recipients = row
    ? [...(await employeesRepository.userIdsByRole(ctx.companyId, issuer)), ...(await employeesRepository.userIdsByRole(ctx.companyId, 'DIRECTOR'))]
    : await employeesRepository.userIdsByRole(ctx.companyId, 'SYSTEM_ADMIN');
  await notifyMany(recipients, 'document.mismatch', { label: KIND_INFO[kind].label, number }, { dedupeKey: `mismatch:${number}:${now.toISOString().slice(0, 10)}` });
  return { told: true, role: issuer };
}
