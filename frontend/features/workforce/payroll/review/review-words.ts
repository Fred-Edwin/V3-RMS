import type { ReviewLine, ReviewQuery } from '../_shared/types/action-types';

/** Words and rules for the review card (spec S5). */

export const KIND_WORDS: Record<string, string> = {
  MISSING_PAY_PROFILE: 'Missing pay profile',
  NO_PAY_PROFILE: 'Missing pay profile',
  NO_HOURS_BASIS: 'No hours basis',
  NO_OVERTIME_RATE: 'No overtime rate',
  MISSING_BANK: 'Missing bank account',
  NEGATIVE_NET: 'Net pay below zero',
  MOVED_BETWEEN_SYSTEMS: 'Moved between systems',
  UNPAID_ABSENCE: 'Unpaid absence',
  LATENESS_DEDUCTION: 'Lateness',
  LATENESS_CAP_HIT: 'Lateness cap reached',
  NEW_JOINER: 'New joiner',
  LEAVER: 'Leaver',
  ADJUSTMENT: 'Added line',
  BIG_CHANGE: 'Big change from last month',
  OVERTIME_HIGH: 'High overtime',
  MISSING_ID: 'Missing KRA PIN, NSSF or SHA number',
  NO_TIMESHEET_DAYS: 'No timesheet days',
  BANK_DETAILS_CHANGED: 'Bank details changed',
  DUPLICATE_ACCOUNT: 'Same account on two people',
  ARREARS: 'Left out earlier',
  LEFT_OUT: 'Left out of this run',
};
export const kindWords = (kind: string): string => KIND_WORDS[kind] ?? kind.toLowerCase().replace(/_/g, ' ');

/** The kinds that never get a bulk tick: each one is looked at (spec S5). */
export const NOT_BULK: readonly string[] = ['BIG_CHANGE'];

export type ReviewFilter = 'all' | 'blocks' | 'tick' | 'ticked';

/** The server query for a filter chip. */
export function filterQuery(filter: ReviewFilter): Pick<ReviewQuery, 'severity' | 'state'> {
  switch (filter) {
    case 'blocks':
      return { severity: 'BLOCK' };
    case 'tick':
      return { severity: 'TICK', state: 'OPEN' };
    case 'ticked':
      return { state: 'CHECKED' };
    default:
      return {};
  }
}

/** Whether "Tick all of this kind" is offered for the lines shown: one kind, not blocking, not a kind that needs its own look. */
export function bulkKind(lines: readonly ReviewLine[], kind: string | undefined): string | null {
  if (!kind || NOT_BULK.includes(kind)) return null;
  const open = lines.filter((l) => l.kind === kind && l.state === 'OPEN' && l.severity === 'TICK');
  return open.length > 1 ? kind : null;
}

/** "3 of 5 checked" for the card header. */
export const checkedWords = (checked: number, total: number): string => `${checked} of ${total} checked`;

/** The accessible name of a line's checkbox: "Check: Esther Mwende, Nyeri Town, Unpaid absence". */
export const checkboxName = (line: Pick<ReviewLine, 'name' | 'siteName' | 'kind'>): string => `Check: ${line.name}, ${line.siteName}, ${kindWords(line.kind)}`;
