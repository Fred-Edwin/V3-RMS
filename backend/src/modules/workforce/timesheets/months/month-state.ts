import { addDays, monthKey, type NairobiDate } from '../../_shared/time/nairobi-time';

export type MonthState = 'OPEN' | 'TO_APPROVE' | 'APPROVED';

/** The part of a period the state needs. A stored CLOSED/CLOSING row (retired) is read as OPEN; the migration moves them on. */
export interface MonthFacts {
  state: 'OPEN' | 'CLOSING' | 'CLOSED' | 'APPROVED';
  end: NairobiDate;
}

/**
 * Rule (D6): derived, never stored by a sweep. OPEN until the month's last day is over; TO_APPROVE from 00:00 Nairobi on the
 * day after it; APPROVED once the site's manager has approved. Nothing closes by itself.
 */
export function monthStateOf(period: MonthFacts, today: NairobiDate): MonthState {
  if (period.state === 'APPROVED') return 'APPROVED';
  return today > period.end ? 'TO_APPROVE' : 'OPEN';
}

/** The month a period belongs to (its last day's month), e.g. "2026-09". */
export const monthKeyOf = (period: { end: NairobiDate }): string => monthKey(period.end);

export const isMonthKey = (value: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/** First and last calendar day of a month key. */
export function monthBounds(key: string): { first: NairobiDate; last: NairobiDate } {
  const [year, month] = key.split('-').map(Number) as [number, number];
  const first = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01` as NairobiDate;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { first, last: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}` as NairobiDate };
}

/** Rule (D5): a month can be approved only once it has ended. The first day it can be approved is the day after its last day. */
export const firstApprovalDay = (period: { end: NairobiDate }): NairobiDate => addDays(period.end, 1);

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
export const monthNameOf = (key: string): string => MONTH_NAMES[Number(key.slice(5, 7)) - 1] ?? key;
export const monthLabelOf = (key: string): string => `${monthNameOf(key)} ${key.slice(0, 4)}`;
