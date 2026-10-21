import { createHash } from 'node:crypto';
import { stableStringify } from '../../timesheets/approval/snapshot';
import { hashPrefixOf } from '../../_shared/documents/qr-hash';
import { noticeNumberLabel } from '../_shared/conduct-model';
import type { ConductNotice } from '../_shared/conduct-notices-repository';
import type { ConductDecision } from '../appeals/decisions-repository';

type DecisionStamp = Pick<ConductDecision, 'version' | 'outcome' | 'decidedAt'>;

/**
 * The one hash of a letter version. It is taken from the frozen snapshot, never from the PDF bytes, because the QR is drawn inside the
 * PDF and cannot carry the hash of its own page. It holds the number, the version, the level, the issue time, the frozen wording and
 * facts, and which decisions the version includes, and nothing that changes later (the receipt, the status): a copy printed before
 * the person signed keeps verifying after. Decision reasons are not in it. A version has its own hash, so a copy of version 1 reads
 * "replaced" once version 2 exists.
 */
export function conductDocumentHash(notice: ConductNotice, version: number, decisions: readonly DecisionStamp[]): string {
  const upTo = decisions.filter((d) => d.version <= version).map((d) => ({ v: d.version, o: d.outcome, at: d.decidedAt.toISOString() }));
  const content = {
    n: noticeNumberLabel(notice.number),
    v: version,
    level: notice.level,
    issuedAt: notice.issuedAt.toISOString(),
    letter: notice.letterSnapshot,
    facts: notice.factsSnapshot,
    decisions: upTo,
  };
  return createHash('sha256').update(stableStringify(content)).digest('hex');
}

/** What the QR on a letter carries: the public verify address of this version. */
export const verifyAddressOf = (origin: string, notice: ConductNotice, version: number, decisions: readonly DecisionStamp[]): string =>
  `${origin.replace(/\/$/, '')}/verify/wrn/${noticeNumberLabel(notice.number)}?h=${hashPrefixOf(conductDocumentHash(notice, version, decisions))}`;
