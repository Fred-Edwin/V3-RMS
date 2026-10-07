/**
 * Africa/Nairobi days for Stock and Waste. Nairobi is UTC+3 all year with no daylight saving, so a fixed offset is exact.
 * Every function is pure: the clock is always passed in, never read here.
 */
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n: number): string => String(n).padStart(2, '0');

/** A Date whose UTC fields read as the Nairobi wall clock. Only the `getUTC*` getters of the result mean anything. */
const wall = (date: Date): Date => new Date(date.getTime() + NAIROBI_OFFSET_MS);

/** "2026-10-13": the Nairobi calendar day of an instant. */
export const nairobiDay = (date: Date): string => wall(date).toISOString().slice(0, 10);

/** The instant a `YYYY-MM-DD` Nairobi day starts (00:00 Nairobi). */
export const dayStartInstant = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - NAIROBI_OFFSET_MS);
};

/** The instant the day after `day` starts: the exclusive end of that Nairobi day. */
export const dayEndInstant = (day: string): Date => new Date(dayStartInstant(day).getTime() + DAY_MS);

/** The Nairobi day `days` before or after `day` (negative goes back). */
export const addDays = (day: string, days: number): string => nairobiDay(new Date(dayStartInstant(day).getTime() + days * DAY_MS));

/** The instant the Nairobi day of `date` started. */
export const startOfNairobiDay = (date: Date): Date => dayStartInstant(nairobiDay(date));

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const partsOf = (day: string): { y: number; m: number; d: number; weekday: number } => {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  return { y: date.getUTCFullYear(), m: date.getUTCMonth(), d: date.getUTCDate(), weekday: date.getUTCDay() };
};

/** "13 Oct" */
export const shortDayText = (day: string): string => {
  const p = partsOf(day);
  return `${p.d} ${MONTHS[p.m]}`;
};

/** "Tue 13 Oct" */
export const weekdayDayText = (day: string): string => `${WEEKDAYS[partsOf(day).weekday]} ${shortDayText(day)}`;

/** "Tue 13 Oct 2026" */
export const fullDayText = (day: string): string => `${weekdayDayText(day)} ${partsOf(day).y}`;

/** Whole days from `earlier` to `later`, both `YYYY-MM-DD` Nairobi days. */
export const daysBetweenDays = (earlier: string, later: string): number => Math.round((dayStartInstant(later).getTime() - dayStartInstant(earlier).getTime()) / DAY_MS);

/** "Today", "Yesterday", "12 days ago": whole Nairobi days, so 23:50 yesterday is "Yesterday". */
export const daysAgoText = (at: Date, now: Date): string => {
  const days = daysBetweenDays(nairobiDay(at), nairobiDay(now));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
};

/** "14:20" */
export const clockText = (date: Date): string => {
  const w = wall(date);
  return `${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`;
};
