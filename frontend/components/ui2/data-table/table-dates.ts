import type { DateRange } from '../date-range-picker';

/**
 * The date-range filter's rules, kept pure so they are unit-tested without a browser (UI_BUILD_RULES §4a).
 *
 * The URL holds `from` and `to` (`YYYY-MM-DD`, Nairobi days) only when the person chose something other than the table's
 * starting range. "Any time" is written as `from=any`. A hand-edited or half-written pair falls back to the starting range.
 */

export type DatePreset = 'today' | 'last7' | 'last30' | 'any';

export const ANY_TIME = 'any';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** Today in Nairobi as `YYYY-MM-DD`. */
export function nairobiToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(now);
}

const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** The range a preset means on `today`, or null for "any time". */
export function presetRange(preset: DatePreset, today: string): DateRange | null {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'last7':
      return { from: addDays(today, -6), to: today };
    case 'last30':
      return { from: addDays(today, -29), to: today };
    case 'any':
      return null;
  }
}

/** The range the table is showing: what the URL says, else the starting range. Null means "any time". */
export function effectiveRange(values: Record<string, string>, keys: { fromKey: string; toKey: string }, preset: DatePreset, today: string): DateRange | null {
  const from = values[keys.fromKey];
  const to = values[keys.toKey];
  if (from === ANY_TIME) return null;
  if (from && to && DAY.test(from) && DAY.test(to) && from <= to) return { from, to };
  return presetRange(preset, today);
}

/**
 * What to write to the URL after a choice: nothing when it is the starting range (so the clean address is the default view),
 * `from=any` for "any time", else the two days. Values `''` clear a key.
 */
export function rangeToFilters(range: DateRange | null, keys: { fromKey: string; toKey: string }, preset: DatePreset, today: string): Record<string, string> {
  const start = presetRange(preset, today);
  const same = range === null ? start === null : start !== null && start.from === range.from && start.to === range.to;
  if (same) return { [keys.fromKey]: '', [keys.toKey]: '' };
  if (range === null) return { [keys.fromKey]: ANY_TIME, [keys.toKey]: '' };
  return { [keys.fromKey]: range.from, [keys.toKey]: range.to };
}

/** True when the person moved the range off its starting value (so "Clear filters" has something to clear). */
export const rangeIsNarrowed = (values: Record<string, string>, keys: { fromKey: string; toKey: string }): boolean => Boolean(values[keys.fromKey] || values[keys.toKey]);
