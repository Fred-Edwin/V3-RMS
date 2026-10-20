import { timingSafeEqual } from 'node:crypto';
import { KIND_INFO, type DocumentKind } from '../_shared/documents/document-kinds';
import type { DocumentRow } from '../_shared/documents/documents-repository';
import { statusOf } from '../documents/document-view';

export const EMPLOYER_NAME = 'Wendo Coffee Bistro';

export type PublicOutcome = 'GENUINE' | 'REPLACED' | 'WITHDRAWN' | 'ARCHIVED' | 'NOT_VERIFIED' | 'MALFORMED' | 'RATE_LIMITED';
/** What the counter table keeps: unknown number and wrong hash are one answer to the public but two rows for us. */
export type RecordedOutcome = PublicOutcome | 'UNKNOWN' | 'HASH_MISMATCH';

/** The only keys a public answer may ever carry (a test pins this list). */
export const PUBLIC_KEYS = ['outcome', 'kind', 'number', 'documentLabel', 'version', 'periodLabel', 'signedByRole', 'signedOn', 'replacedByNumber', 'replacedByVersion', 'replacedOn', 'withdrawnOn', 'withdrawnByRole', 'checkedAt', 'employerName'] as const;

export interface PublicAnswer {
  outcome: PublicOutcome;
  kind?: DocumentKind;
  number?: string;
  documentLabel?: string;
  version?: number;
  periodLabel?: string;
  signedByRole?: string;
  signedOn?: string;
  replacedByNumber?: string;
  replacedByVersion?: number;
  replacedOn?: string;
  withdrawnOn?: string;
  withdrawnByRole?: string;
  checkedAt: string;
  employerName: string;
}

/** Equal-length compare of two short hex strings without an early exit. */
export function samePrefix(a: string, b: string): boolean {
  const x = Buffer.from(a.padEnd(16, '-').slice(0, 16));
  const y = Buffer.from(b.padEnd(16, '-').slice(0, 16));
  return timingSafeEqual(x, y) && a.length === b.length;
}

export const bare = (outcome: PublicOutcome, now: Date): PublicAnswer => ({ outcome, checkedAt: now.toISOString(), employerName: EMPLOYER_NAME });

/** Which stored version the QR's hash names, comparing against every version so the time does not depend on which one matches. */
export function matchVersion(rows: readonly DocumentRow[], h: string): DocumentRow | null {
  let found: DocumentRow | null = null;
  for (const row of rows) if (samePrefix(row.hashPrefix, h) && !found) found = row;
  return found;
}

/** Role and date only: never a name, a figure, a head count or a site. */
export function answerFor(row: DocumentRow, now: Date): { answer: PublicAnswer; recorded: RecordedOutcome } {
  const status = statusOf(row, now);
  const base: PublicAnswer = {
    ...bare('GENUINE', now),
    kind: row.kind as DocumentKind,
    number: row.number,
    documentLabel: KIND_INFO[row.kind as DocumentKind].label,
    version: row.version,
    periodLabel: row.about,
    signedByRole: row.signedByRole,
    signedOn: row.signedAt.toISOString(),
  };
  if (status === 'WITHDRAWN') {
    return { recorded: 'WITHDRAWN', answer: { ...base, outcome: 'WITHDRAWN', ...(row.withdrawnAt ? { withdrawnOn: row.withdrawnAt.toISOString() } : {}), ...(row.withdrawnByRole ? { withdrawnByRole: row.withdrawnByRole } : {}), ...(row.replacedByNumber ? { replacedByNumber: row.replacedByNumber } : {}) } };
  }
  if (status === 'ARCHIVED') return { recorded: 'ARCHIVED', answer: { ...base, outcome: 'ARCHIVED' } };
  if (status === 'REPLACED') {
    return { recorded: 'REPLACED', answer: { ...base, outcome: 'REPLACED', ...(row.replacedByVersion ? { replacedByVersion: row.replacedByVersion, replacedByNumber: row.number } : {}), ...(row.replacedAt ? { replacedOn: row.replacedAt.toISOString() } : {}) } };
  }
  return { recorded: 'GENUINE', answer: base };
}
