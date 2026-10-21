import type { LetterSnapshot, FactsSnapshot } from '../_shared/conduct-snapshots';
import { longDateOf } from '../letters/letter-text';
import { shortDayTime } from '../_shared/conduct-format';
import type { ConductNotice } from '../_shared/conduct-notices-repository';
import type { ConductDecision } from '../appeals/decisions-repository';
import { verifyAddressOf } from './notice-hash';

/** Everything the A4 letter draws, built from the frozen snapshot, the signatures and the decisions up to the version asked for. */
export interface ConductDoc {
  number: string; // "WRN-0007" or "WRN-draft"
  siteName: string;
  dateLong: string;
  letter: LetterSnapshot;
  facts: FactsSnapshot | null;
  issuerSignature: { name: string; roleLine: string; signedLine: string } | null;
  receipt: { name: string; roleLine: string; signedLine: string; empty: boolean } | null;
  decision: { outcome: string; reason: string; byName: string; byRole: string; signedLine: string } | null;
  watermark: 'WITHDRAWN' | 'DRAFT' | null;
  stamp: string | null;
  qrUrl: string | null;
  created: Date;
}

const OUTCOME_TITLE: Record<string, string> = {
  KEEP: 'Appeal decided: the notice is kept',
  REDUCE_TO_WRITTEN: 'Appeal decided: reduced to a written warning',
  REDUCE_TO_VERBAL: 'Appeal decided: reduced to a verbal note',
  WITHDRAW: 'Decision: the notice is withdrawn',
};

const NOT_SIGNED_WORDS: Record<string, string> = { REFUSED: 'refused', NOT_REACHED: 'not reached', NO_LOGIN: 'no login' };

function receiptOf(notice: ConductNotice, letter: LetterSnapshot, witness: { name: string; role: string } | null, recordedBy: string | null): ConductDoc['receipt'] {
  const name = letter.person.name;
  if (notice.signedAt) {
    const late = notice.notSignedRecordedAt ? ` (after the ${notice.ackDays} days)` : '';
    return { name, roleLine: `Received by ${name}`, signedLine: `Signed on the phone with a code · ${shortDayTime(notice.signedAt)}${late}`, empty: false };
  }
  if (notice.notSignedRecordedAt) {
    const who = witness ? ` · witnessed by ${witness.name}, ${witness.role}` : '';
    return { name, roleLine: 'Given, not signed', signedLine: `${NOT_SIGNED_WORDS[notice.notSignedReason ?? ''] ?? 'not signed'}${who} · recorded ${shortDayTime(notice.notSignedRecordedAt)}${recordedBy ? ` by ${recordedBy}` : ''}`, empty: false };
  }
  return { name, roleLine: `Received by ${name}`, signedLine: 'Not yet signed. Receipt is recorded here when the person signs.', empty: true };
}

/**
 * The letter for one version: version 1 is as issued; each later version adds the decisions up to it (a decision page). The
 * frozen snapshot is the only source of wording, so a Rules or wording change never alters an issued letter. A withdrawn notice
 * carries the WITHDRAWN watermark on every page.
 */
export function buildConductDoc(args: {
  notice: ConductNotice;
  version: number;
  decisions: readonly ConductDecision[];
  withdrawn: boolean;
  witness: { name: string; role: string } | null;
  recordedBy: string | null;
  origin: string;
}): ConductDoc {
  const { notice } = args;
  const letter = notice.letterSnapshot as unknown as LetterSnapshot;
  const upTo = args.decisions.filter((d) => d.version <= args.version);
  const last = upTo[upTo.length - 1];
  return {
    number: `WRN-${String(notice.number ?? 0).padStart(4, '0')}`,
    siteName: notice.siteName,
    dateLong: longDateOf(notice.issuedAt),
    letter,
    facts: (notice.factsSnapshot as unknown as FactsSnapshot | null) ?? null,
    issuerSignature: { name: notice.issuerName, roleLine: `${notice.issuerName} · ${notice.issuerRole}`, signedLine: `Signed with PIN · ${shortDayTime(notice.issuedAt)}` },
    receipt: notice.replacesNoticeId ? null : receiptOf(notice, letter, args.witness, args.recordedBy),
    decision: last ? { outcome: OUTCOME_TITLE[last.outcome] ?? 'Decision', reason: last.reason, byName: last.decidedByName, byRole: last.decidedByRole, signedLine: `Signed with PIN · ${shortDayTime(last.decidedAt)}` } : null,
    watermark: args.withdrawn ? 'WITHDRAWN' : null,
    stamp: args.withdrawn ? 'WITHDRAWN' : null,
    qrUrl: verifyAddressOf(args.origin, notice, args.version, args.decisions),
    created: last?.decidedAt ?? notice.issuedAt,
  };
}
