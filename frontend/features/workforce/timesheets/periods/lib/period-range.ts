import type { Period } from '../../_shared/types/timesheet-types';

/**
 * The days the Timesheets page shows (the week picker). The page opens on the whole month up to today, so its figures are the month's;
 * choosing a week or any range narrows the numbers and the people to those days. A range that equals the whole month is no range at all,
 * so the request carries no dates and the clean address stays the default view. Days are Nairobi dates; comparing the strings is exact.
 */
export interface DayRange {
  from: string;
  to: string;
}

/** The whole month, but never past today (a day that has not happened has no time on it). */
export function wholeMonth(period: Pick<Period, 'start' | 'end'>, today: string): DayRange {
  return { from: period.start, to: period.end < today ? period.end : today < period.start ? period.start : today };
}

/** What the picker is showing: the chosen range, else the whole month. */
export const shownRange = (chosen: DayRange | null, period: Pick<Period, 'start' | 'end'>, today: string): DayRange => chosen ?? wholeMonth(period, today);

/** True when the range is the whole month, so nothing is narrowed. */
export function isWholeMonth(range: DayRange, period: Pick<Period, 'start' | 'end'>, today: string): boolean {
  const whole = wholeMonth(period, today);
  return range.from === whole.from && range.to === whole.to;
}

/** The range as the picker hands it back, kept only if it narrows anything, and clamped to the month. */
export function chosenRange(range: DayRange | null, period: Pick<Period, 'start' | 'end'>, today: string): DayRange | null {
  if (range === null) return null;
  const clamped = { from: range.from < period.start ? period.start : range.from, to: range.to > period.end ? period.end : range.to };
  if (clamped.from > clamped.to) return null;
  return isWholeMonth(clamped, period, today) ? null : clamped;
}

/** Query parts for the API: both dates, or none. */
export const rangeQuery = (chosen: DayRange | null): { from?: string; to?: string } => (chosen ? { from: chosen.from, to: chosen.to } : {});
