import { addDays, daysBetween, type NairobiDate } from '../../_shared/time/nairobi-time';
import { isMonthKey, monthBounds } from '../../timesheets/months/rules/month-state';

export { isMonthKey, monthBounds };

export interface DayRange {
  from: NairobiDate;
  to: NairobiDate;
}

export interface MonthWindow {
  monthKey: string;
  first: NairobiDate;
  last: NairobiDate;
  days: number;
}

export function monthWindow(monthKey: string): MonthWindow {
  const { first, last } = monthBounds(monthKey);
  return { monthKey, first, last, days: daysBetween(first, last) + 1 };
}

/** The month before, e.g. "2026-01" is preceded by "2025-12". */
export function previousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number) as [number, number];
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}

/** The month has ended once Nairobi's date is past its last day (not at UTC midnight: the Nairobi day decides). */
export const monthHasEnded = (window: MonthWindow, today: NairobiDate): boolean => today > window.last;

/** Whole days between the last day of the month and today (0 on the last day itself). */
export const daysSinceMonthEnd = (window: MonthWindow, today: NairobiDate): number => Math.max(0, daysBetween(window.last, today));

/** The parts of an employment spell inside the month, as Nairobi day ranges (inclusive). A spell open-ended runs to the month's last day. */
export function employedRanges(window: MonthWindow, spells: readonly { startsOn: NairobiDate; endedOn: NairobiDate | null }[]): DayRange[] {
  const ranges: DayRange[] = [];
  for (const spell of [...spells].sort((a, b) => (a.startsOn < b.startsOn ? -1 : 1))) {
    const from = spell.startsOn > window.first ? spell.startsOn : window.first;
    const to = spell.endedOn !== null && spell.endedOn < window.last ? spell.endedOn : window.last;
    if (from > to) continue;
    const previous = ranges[ranges.length - 1];
    if (previous && addDays(previous.to, 1) >= from) previous.to = to > previous.to ? to : previous.to;
    else ranges.push({ from, to });
  }
  return ranges;
}

export const rangeDays = (ranges: readonly DayRange[]): number => ranges.reduce((total, range) => total + daysBetween(range.from, range.to) + 1, 0);

export interface AmountSegment {
  amount: string;
  days: number;
}

/**
 * The pay amount in force for each employed day, as segments. `amountAt` is the People door (`payAmountOn`), asked as little as
 * possible: a range whose first and last day have the same amount is one segment, otherwise it is split in half and each half is
 * asked again, so a month with one pay change costs about 2 + log2(31) questions rather than 31. (A change and a change back
 * inside one range with the same amount at both ends would be missed; pay changes start on one day and last.) Days with no amount
 * in force are not paid and are returned as `unpricedDays`.
 */
export async function amountSegments(ranges: readonly DayRange[], amountAt: (date: NairobiDate) => Promise<string | null>): Promise<{ segments: AmountSegment[]; unpricedDays: number; lastAmount: string | null }> {
  const cache = new Map<NairobiDate, string | null>();
  const ask = async (date: NairobiDate): Promise<string | null> => {
    if (!cache.has(date)) cache.set(date, await amountAt(date));
    return cache.get(date) ?? null;
  };
  const out: AmountSegment[] = [];
  let unpriced = 0;
  const walk = async (from: NairobiDate, to: NairobiDate): Promise<void> => {
    const start = await ask(from);
    const end = await ask(to);
    if (start === end) {
      const days = daysBetween(from, to) + 1;
      if (start === null) unpriced += days;
      else out.push({ amount: start, days });
      return;
    }
    const middle = addDays(from, Math.floor(daysBetween(from, to) / 2));
    await walk(from, middle);
    await walk(addDays(middle, 1), to);
  };
  for (const range of ranges) await walk(range.from, range.to);
  const merged: AmountSegment[] = [];
  for (const segment of out) {
    const last = merged[merged.length - 1];
    if (last && last.amount === segment.amount) last.days += segment.days;
    else merged.push({ ...segment });
  }
  const lastRange = ranges[ranges.length - 1];
  return { segments: merged, unpricedDays: unpriced, lastAmount: lastRange ? await ask(lastRange.to) : null };
}
