import type { Prisma } from '@prisma/client';
import type { IssuedDocument, RegisterDocumentInput } from '../../_shared/documents/documents.types';
import { registerDocument, withdrawDocument } from '../../_shared/documents/register-document';
import { nairobiDateOf } from '../../_shared/time/nairobi-time';
import { dayLabel } from '../../notifications';
import { hasLetter, LEVEL_LABELS, noticeNumberLabel } from '../_shared/conduct-model';
import type { ConductNotice } from '../_shared/conduct-notices-repository';
import { receiptIsFinal } from '../_shared/conduct-status';
import { decisionsRepository, type ConductDecision } from '../appeals/decisions-repository';
import { conductDocumentHash } from './notice-hash';
import { noticeSourceRepository } from './notice-source-repository';

/**
 * A notice is indexed once it has a letter, a number and a final receipt: signed, appealed, decided, ended, or recorded by a reduction.
 * One still waiting for the person (issued, or given-not-signed where a late signature may yet come) is not: same rule as the stored copy.
 */
export const isIndexable = (notice: ConductNotice): boolean => hasLetter(notice.level) && notice.number !== null && notice.letterSnapshot !== null && receiptIsFinal(notice);

/**
 * What `registerDocument` gets for one version of a letter. The title carries the level, the about line the issue day; no reason, no
 * category of conduct and no fact ever reaches the index or the public page. Version 1 is signed by the issuer, a later version by
 * whoever decided.
 */
export function noticeDocumentInput(notice: ConductNotice, version: number, decisions: readonly ConductDecision[]): RegisterDocumentInput {
  const decided = decisions.find((d) => d.version === version);
  return {
    companyId: notice.companyId,
    siteId: notice.siteId,
    kind: 'WRN',
    number: noticeNumberLabel(notice.number) ?? '',
    version,
    title: `Warning notice · ${LEVEL_LABELS[notice.level]}`,
    about: dayLabel(nairobiDateOf(notice.issuedAt)),
    subjectUserId: notice.personUserId,
    signedBy: decided ? { id: decided.decidedById, name: decided.decidedByName, role: decided.decidedByRole } : { id: notice.issuerId, name: notice.issuerName, role: notice.issuerRole },
    signedAt: decided ? decided.decidedAt : notice.issuedAt,
    hash: conductDocumentHash(notice, version, decisions),
    openHref: `/workforce/conduct/${notice.id}/document`,
  };
}

/** Who withdrew it and when, from the newest decision (a notice is withdrawn only by a decision). */
const withdrawnBy = (notice: ConductNotice, decisions: readonly ConductDecision[]): { at: Date; byRole: string } => {
  const last = decisions[decisions.length - 1];
  return { at: last?.decidedAt ?? notice.decidedAt ?? notice.updatedAt, byRole: last?.decidedByRole ?? notice.issuerRole };
};

/**
 * THE Conduct call into the Signed documents door. Every service that moves a notice to a final receipt, decides it, or ends it calls
 * this inside its own transaction with the row it just wrote: versions 1 to `documentVersion` are registered (a repeat is a no-op,
 * and a newer version marks the older one replaced), and a withdrawn notice is withdrawn. Verbal notes and notices still waiting for
 * a receipt are not indexed.
 */
export async function indexNotice(tx: Prisma.TransactionClient, notice: ConductNotice): Promise<void> {
  if (!isIndexable(notice)) return;
  const decisions = await decisionsRepository.forNotice(notice.id, tx);
  for (let version = 1; version <= notice.documentVersion; version += 1) await registerDocument(tx, noticeDocumentInput(notice, version, decisions));
  if (notice.status === 'WITHDRAWN') await withdrawDocument(tx, { companyId: notice.companyId, number: noticeNumberLabel(notice.number) ?? '', ...withdrawnBy(notice, decisions) });
}

/** WRN source for the reconciliation: every indexable notice, every version, a withdrawn one listed withdrawn. */
export async function issuedConductNotices(companyId: string): Promise<IssuedDocument[]> {
  const notices = await noticeSourceRepository.letters(companyId);
  const decisionsOf = await noticeSourceRepository.decisions(notices.map((n) => n.id));
  return notices.filter(isIndexable).flatMap((notice): IssuedDocument[] => {
    const decisions = decisionsOf.get(notice.id) ?? [];
    return Array.from({ length: notice.documentVersion }, (_, i): IssuedDocument => {
      const version = i + 1;
      const last = version === notice.documentVersion;
      return { input: noticeDocumentInput(notice, version, decisions), ...(last && notice.status === 'WITHDRAWN' ? { withdrawn: withdrawnBy(notice, decisions) } : {}) };
    });
  });
}
