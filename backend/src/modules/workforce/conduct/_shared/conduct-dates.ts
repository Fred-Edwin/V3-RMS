import { addDays, instantAt, nairobiDateOf, parseClockTime, parseNairobiDate, type NairobiDate } from '../../_shared/time/nairobi-time';

const MIDNIGHT = parseClockTime('00:00');
const pad = (n: number): string => String(n).padStart(2, '0');

const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Calendar months added to a Nairobi date, clamped to the month end: 31 Aug + 6 months is 28 Feb; 9 Oct + 6 months is 9 Apr (C21). */
export function addMonthsClamped(date: NairobiDate, months: number): NairobiDate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return parseNairobiDate(`${year}-${pad(month)}-${pad(Math.min(d, daysInMonth(year, month)))}`);
}

/** The last day a notice is active: the issue date plus the level's months, stored on the notice at issue (D29). */
export const validUntilOf = (issuedAt: Date, months: number): NairobiDate => addMonthsClamped(nairobiDateOf(issuedAt), months);

/** The end of a Nairobi day, as an instant (23:59:59.999). */
export const endOfDay = (date: NairobiDate): Date => new Date(instantAt(addDays(date, 1), MIDNIGHT).getTime() - 1);

/** The appeal window closes at 23:59 Nairobi on the Nth day after issue, signed or not (C15). Issue 9 Oct, 7 days: 16 Oct. */
export const appealDeadline = (issuedAt: Date, appealDays: number): Date => endOfDay(addDays(nairobiDateOf(issuedAt), appealDays));

/** The last day to sign: the issue date plus the notice's own sign days. */
export const signLimitDate = (issuedAt: Date, ackDays: number): NairobiDate => addDays(nairobiDateOf(issuedAt), ackDays);

/** "Not signed" may be recorded from the day after the sign limit (C13); a person with no login: at once. */
export const recordableFrom = (issuedAt: Date, ackDays: number): Date => instantAt(addDays(signLimitDate(issuedAt, ackDays), 1), MIDNIGHT);

/** HR's decision is due this many days after the appeal; the Director is told on the next day (C20). */
export const decisionDueBy = (appealedAt: Date, days: number): Date => endOfDay(addDays(nairobiDateOf(appealedAt), days));

/** Whole days late: 0 until the due moment has passed. */
export function overdueDays(dueBy: Date, now: Date): number {
  if (now <= dueBy) return 0;
  return Math.max(1, Math.ceil((now.getTime() - dueBy.getTime()) / 86_400_000));
}

/** A notice is active through its `validUntil` day and ended from 00:00 Nairobi the next day (derived at read time). */
export const isInsideEndDate = (validUntil: Date, now: Date): boolean => nairobiDateOf(validUntil) >= nairobiDateOf(now);
