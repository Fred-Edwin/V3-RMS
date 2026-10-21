import { createHash } from 'node:crypto';
import { AppError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { nairobiToday } from '../../_shared/time/nairobi-time';
import { workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { conductActor, conductEntry, roleName } from '../_shared/conduct-context';
import { appealDeadline, validUntilOf } from '../_shared/conduct-dates';
import { jobLabelOf, loadReadable } from '../_shared/conduct-load';
import { hasLetter, noticeNumberLabel } from '../_shared/conduct-model';
import type { ConductNotice } from '../_shared/conduct-notices-repository';
import { conductPeopleRepository } from '../_shared/conduct-people-repository';
import { isSubject } from '../_shared/conduct-scope';
import { receiptIsFinal } from '../_shared/conduct-status';
import { decisionsRepository } from '../appeals/decisions-repository';
import { factsFor, personForIssue } from '../notices/issue-service';
import type { PreviewBody } from '../notices/notices-validators';
import { buildLetter } from '../letters/letter-fill';
import { renderConductPdf } from './conduct-pdf';
import { buildConductDoc, type ConductDoc } from './document-model';
import { documentsRepository } from './documents-repository';

export interface RenderedDocument {
  bytes: Buffer;
  fileName: string;
  hash: string;
}

export { receiptIsFinal };

const sha = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

async function witnessAndRecorder(notice: ConductNotice): Promise<{ witness: { name: string; role: string } | null; recordedBy: string | null }> {
  const ids = [notice.witnessConfirmedAt ? notice.witnessId : null, notice.notSignedById].filter((id): id is string => id !== null);
  const users = await conductPeopleRepository.usersByIds(ids);
  const byId = new Map(users.map((u) => [u.id, u]));
  const witness = notice.witnessConfirmedAt && notice.witnessId ? byId.get(notice.witnessId) : undefined;
  return { witness: witness ? { name: witness.name, role: roleName(witness.role) } : null, recordedBy: notice.notSignedById ? (byId.get(notice.notSignedById)?.name ?? null) : null };
}

function pickVersion(notice: ConductNotice, asked: 'latest' | number): number {
  const version = asked === 'latest' ? notice.documentVersion : asked;
  if (version < 1 || version > notice.documentVersion) throw new NotFoundError('We could not find that version.', 'DOCUMENT_VERSION_NOT_FOUND');
  return version;
}

/**
 * The letter as a PDF (S10). Built from the frozen snapshot on request; a copy is stored once the receipt is final, and a
 * withdrawn notice has its own watermarked copy of each version. The person reads their own letter without a trace; anyone else
 * opening it leaves a `conduct.document_read` entry in the same transaction as the read (spec section 11).
 */
export async function noticeDocument(subject: AccessSubject, noticeId: string, asked: 'latest' | number, origin: string, deviceLabel: string | null): Promise<RenderedDocument> {
  const ctx = await conductActor(subject, workforceCan(subject, 'discipline.read') ? 'discipline.read' : 'discipline.read_own');
  const { notice } = await loadReadable(subject, ctx.companyId, noticeId);
  if (!hasLetter(notice.level) || notice.number === null) throw new NotFoundError('A verbal note has no letter.', 'NO_DOCUMENT');
  const version = pickVersion(notice, asked);
  const withdrawn = notice.status === 'WITHDRAWN';
  const label = noticeNumberLabel(notice.number);
  const fileName = version === 1 ? `${label}.pdf` : `${label}-v${version}.pdf`;

  let stored = await documentsRepository.find(notice.id, version, withdrawn);
  if (!stored) {
    const decisions = await decisionsRepository.forNotice(notice.id);
    const { witness, recordedBy } = await witnessAndRecorder(notice);
    const bytes = await renderConductPdf(buildConductDoc({ notice, version, decisions, withdrawn, witness, recordedBy, origin }));
    stored = { bytes, hash: sha(bytes) };
    if (receiptIsFinal(notice) || withdrawn) await documentsRepository.store(notice.id, version, withdrawn, stored);
  }
  if (!isSubject(subject, notice)) {
    await runAudited<void>(async () => ({
      result: undefined,
      entries: [conductEntry({ ctx, siteId: notice.siteId, action: 'conduct.document_read', noticeId: notice.id, subjectUserId: notice.personUserId, after: { number: label, version }, deviceLabel })],
    }));
  }
  return { bytes: stored.bytes, fileName, hash: stored.hash };
}

/** The draft letter for the issue panel (S9): the same layout, stamped DRAFT, no number, no QR, nothing stored and no audit entry. */
export async function previewDocument(subject: AccessSubject, body: PreviewBody, now: Date = new Date()): Promise<RenderedDocument> {
  const ctx = await conductActor(subject, 'discipline.issue');
  if (!hasLetter(body.level)) throw new AppError(422, 'NO_LETTER', 'A verbal note has no letter to preview.');
  const person = await personForIssue(subject, ctx.companyId, body.personId);
  const facts = await factsFor(person, body.about, body.factsMonth, now);
  const rules = (await getEffectiveRuleGroup(person.siteId, nairobiToday(now), 'CONDUCT')).values;
  const levelRule = rules.levels.find((l) => l.level === body.level);
  if (!levelRule) throw new AppError(409, 'LEVEL_NOT_IN_RULES', 'The Rules have no entry for this level.');
  const validUntil = validUntilOf(now, levelRule.validForMonths);
  const issuerRole = roleName(subject.role);
  const letter = buildLetter({
    level: body.level as Exclude<typeof body.level, 'VERBAL_NOTE'>,
    about: body.about,
    personName: person.name,
    personRole: jobLabelOf(person),
    siteName: person.siteName,
    issuerName: ctx.name,
    issuerRole,
    facts,
    ownLine: body.ownLine,
    issuedAt: now,
    validUntil,
    appealDays: rules.appealWithinDays,
    appealBy: appealDeadline(now, rules.appealWithinDays),
    reducedFromFinalAt: null,
  });
  const model: ConductDoc = {
    number: 'WRN-draft',
    siteName: person.siteName,
    dateLong: letter.issuedAtLong,
    letter,
    facts,
    issuerSignature: { name: ctx.name, roleLine: `${ctx.name} · ${issuerRole}`, signedLine: 'Signed with PIN when issued' },
    receipt: { name: person.name, roleLine: `Received by ${person.name}`, signedLine: 'Not yet signed. Receipt is recorded here when the person signs.', empty: true },
    decision: null,
    watermark: 'DRAFT',
    stamp: 'DRAFT',
    qrUrl: null,
    created: now,
  };
  const bytes = await renderConductPdf(model);
  return { bytes, fileName: 'WRN-draft.pdf', hash: sha(bytes) };
}
