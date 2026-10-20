import { AppError, ValidationError } from '../../../utils/errors';
import { logger } from '../../../utils/logger';
import { verifyAuditChain, type ChainVerdict } from '../_shared/audit/audit-hash';
import { auditRepository } from '../_shared/audit/audit-repository';
import { runAudited } from '../_shared/audit/audit-writer';
import { hitLimit } from '../_shared/limits/rate-limit';
import { isoWeekday, nairobiToday } from '../_shared/time/nairobi-time';
import { workforceCan, type AccessSubject } from '../_shared/workforce-access';
import { resolveActor, told } from '../people/people-context';
import { employeesRepository } from '../people/employees/employees-repository';
import { insertAlertForEntry, tellAdminsOfAlert, type AlertFacts } from '../security';
import { auditReadRepository } from './audit-read-repository';
import { MAX_CHAIN_ENTRIES } from './audit-validators';

const BATCH = 5_000;

export interface ChainCheck {
  ok: boolean;
  checked: number;
  fromSeq: string;
  toSeq: string;
  firstBadSeq?: string;
  problem?: string;
}

/** Re-checks seq `fromSeq` to `toSeq` of one company in batches. Memory stays at one batch however long the slice. */
export async function verifyRange(companyId: string, fromSeq: bigint, toSeq: bigint): Promise<ChainVerdict> {
  const before = fromSeq > 1n ? await auditReadRepository.entryAtSeq(companyId, fromSeq - 1n) : null;
  if (fromSeq > 1n && !before) return { ok: false, atSeq: fromSeq, problem: 'GAP' };
  let start = before ? { seq: before.seq, hash: before.hash } : undefined;
  let checked = 0;
  let cursor = fromSeq - 1n;
  while (cursor < toSeq) {
    const take = Number(toSeq - cursor < BigInt(BATCH) ? toSeq - cursor : BigInt(BATCH));
    const entries = await auditRepository.listEntries(companyId, cursor, take);
    if (entries.length === 0) break;
    const verdict = verifyAuditChain(entries, start);
    if (!verdict.ok) return verdict;
    checked += verdict.checked;
    start = { seq: verdict.lastSeq, hash: verdict.lastHash };
    cursor = verdict.lastSeq;
  }
  return { ok: true, checked, lastSeq: start?.seq ?? 0n, lastHash: start?.hash ?? '' };
}

/**
 * A break in the chain: one `audit.chain_failed` entry, its System Admin alert in the same transaction, then the System Admins and the
 * Director are told. At most once an hour per company and entry, so a nightly run and a manual check do not both shout.
 */
export async function reportChainFailure(companyId: string, atSeq: bigint, now: Date = new Date()): Promise<boolean> {
  const first = await hitLimit(`chain-failed:${companyId}:${atSeq}`, 1, 3600, now.getTime());
  if (!first.allowed) return false;
  const facts: AlertFacts = { companyId, siteId: null, kind: 'CHAIN_FAILED', subjectUserId: null, detail: atSeq.toString(), at: now };
  await runAudited<void>(async () => ({
    result: undefined,
    entries: [
      {
        companyId,
        siteId: null,
        actor: { id: null, role: 'SYSTEM', name: 'The system' },
        channel: 'SYSTEM',
        action: 'audit.chain_failed',
        category: 'SECURITY',
        subjectType: 'AuditLog',
        subjectId: companyId,
        after: { seq: atSeq.toString() },
      },
    ],
    afterWrite: async (tx, records) => {
      const entry = records[0];
      if (entry) await insertAlertForEntry(tx, facts, entry.id);
    },
  }));
  await tellAdminsOfAlert(facts);
  const directors = await employeesRepository.userIdsByRole(companyId, 'DIRECTOR');
  await told(directors, 'audit.chain_failed', { seq: atSeq.toString() }, { dedupeKey: `chain-failed:${atSeq}:${nairobiToday(now)}` });
  return true;
}

const tooSoon = (): never => {
  throw new AppError(429, 'CHECK_TOO_SOON', 'Wait a minute before checking again.');
};

/** A3. "Check the chain" for a slice. One check a minute per reader; at most 200,000 entries a call. */
export async function checkChain(subject: AccessSubject, body: { fromSeq: number; toSeq: number }, now: Date = new Date()): Promise<ChainCheck> {
  if (!workforceCan(subject, 'audit.verify_chain')) throw new AppError(403, 'AUTHORIZATION_ERROR', 'You do not have permission to perform this action');
  const ctx = await resolveActor(subject);
  const last = await auditReadRepository.lastSeq(ctx.companyId);
  const fromSeq = BigInt(body.fromSeq);
  const toSeq = BigInt(body.toSeq) > last ? last : BigInt(body.toSeq);
  if (toSeq < fromSeq) throw new ValidationError('There is no entry in that range.', 'RANGE_INVALID');
  if (toSeq - fromSeq + 1n > BigInt(MAX_CHAIN_ENTRIES)) throw new ValidationError('Check a smaller range (at most 200,000 entries).', 'RANGE_TOO_LARGE');
  if (!(await hitLimit(`chain-check:${subject.id}`, 1, 60, now.getTime())).allowed) tooSoon();
  const verdict = await verifyRange(ctx.companyId, fromSeq, toSeq);
  if (verdict.ok) return { ok: true, checked: verdict.checked, fromSeq: fromSeq.toString(), toSeq: toSeq.toString() };
  await reportChainFailure(ctx.companyId, verdict.atSeq, now).catch((error: unknown) => logger.error({ err: error }, 'chain failure could not be recorded'));
  return { ok: false, checked: 0, fromSeq: fromSeq.toString(), toSeq: toSeq.toString(), firstBadSeq: verdict.atSeq.toString(), problem: verdict.problem };
}

export interface NightlyResult {
  companies: number;
  checked: number;
  failed: number;
}

/** A6. 02:00 Nairobi: the last two days, and the whole chain on Sundays. A break is reported once; the check itself changes nothing. */
export async function runNightlyChainCheck(now: Date = new Date()): Promise<NightlyResult> {
  const companies = await auditReadRepository.companies();
  const sunday = isoWeekday(nairobiToday(now)) === 7;
  const result: NightlyResult = { companies: companies.length, checked: 0, failed: 0 };
  for (const { id } of companies) {
    try {
      const last = await auditReadRepository.lastSeq(id);
      if (last === 0n) continue;
      const since = new Date(now.getTime() - 2 * 86_400_000);
      const from = sunday ? 1n : ((await auditReadRepository.firstSeqSince(id, since)) ?? last + 1n);
      if (from > last) continue;
      const verdict = await verifyRange(id, from, last);
      if (verdict.ok) result.checked += verdict.checked;
      else {
        result.failed += 1;
        await reportChainFailure(id, verdict.atSeq, now);
      }
    } catch (error) {
      result.failed += 1;
      logger.error({ err: error, companyId: id }, 'nightly audit chain check failed to run');
    }
  }
  return result;
}
