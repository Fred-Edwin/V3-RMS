import { addDays, countDays, dayNumber, mondayOf, weekdayShort } from '../../_shared/lib/leave-dates';
import type { CalendarBar, CalendarView } from '../../_shared/types/leave-types';

export const COLUMNS = 21;
export const COLUMN_PX = 46;

export interface PlacedBar {
  bar: CalendarBar;
  /** 0-based column of the first visible day, and how many columns it spans. */
  column: number;
  span: number;
  /** True when the bar began before the first visible day, or runs on after the last (drawn open-ended). */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/** Puts a bar on the 21-day grid, cutting it at both edges. Null when it lies wholly outside. */
export function placeBar(bar: CalendarBar, from: string): PlacedBar | null {
  const last = addDays(from, COLUMNS - 1);
  if (bar.end < from || bar.start > last) return null;
  const start = bar.start < from ? from : bar.start;
  const end = bar.end > last ? last : bar.end;
  return { bar, column: countDays(from, start) - 1, span: countDays(start, end), continuesBefore: bar.start < from, continuesAfter: bar.end > last };
}

/** The Mondays offered in the "from" select: this week and the 12 after it. */
export function weekStarts(today: string, count = 13): string[] {
  const first = mondayOf(today);
  return Array.from({ length: count }, (_, i) => addDays(first, i * 7));
}

export interface DayHead {
  date: string;
  weekday: string;
  day: number;
}
export const dayHeads = (from: string): DayHead[] => Array.from({ length: COLUMNS }, (_, i) => { const date = addDays(from, i); return { date, weekday: weekdayShort(date).slice(0, 3).toUpperCase(), day: dayNumber(date) }; });

export interface TightDay {
  date: string;
  working: number;
  minimum: number;
  applicationId: string;
}

/** The days below the minimum that a request touches, one per date, first request wins; sorted by date. */
export function tightDaysOf(view: Pick<CalendarView, 'coverRows' | 'clashes'>): TightDay[] {
  const cover = new Map(view.coverRows.map((c) => [c.date, c] as const));
  const seen = new Set<string>();
  const out: TightDay[] = [];
  for (const clash of [...view.clashes].sort((a, b) => a.date.localeCompare(b.date))) {
    if (seen.has(clash.date)) continue;
    seen.add(clash.date);
    const row = cover.get(clash.date);
    if (row && row.minimum !== null) out.push({ date: clash.date, working: row.working, minimum: row.minimum, applicationId: clash.applicationId });
  }
  return out;
}
