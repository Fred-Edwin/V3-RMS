/**
 * Africa/Nairobi time for Counting. Nairobi is UTC+3 all year with no daylight saving, so a fixed offset is exact and keeps
 * every function pure (a clock is always passed in, never read here).
 */
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** A Date whose UTC fields read as the Nairobi wall clock. Only the `getUTC*` getters of the result mean anything. */
const wall = (date: Date): Date => new Date(date.getTime() + NAIROBI_OFFSET_MS);

const pad = (n: number): string => String(n).padStart(2, '0');

/** "2026-10-13": the Nairobi calendar day of an instant. */
export const nairobiDay = (date: Date): string => wall(date).toISOString().slice(0, 10);

/** The instant a Nairobi day starts (00:00 Nairobi), and the instant the next one starts. */
export const nairobiDayStart = (date: Date): Date => new Date(Math.floor(wall(date).getTime() / DAY_MS) * DAY_MS - NAIROBI_OFFSET_MS);
export const nairobiDayEnd = (date: Date): Date => new Date(nairobiDayStart(date).getTime() + DAY_MS);

/** A `YYYY-MM-DD` Nairobi day as the `@db.Date` value Prisma stores (midnight UTC of that date). */
export const dayAsDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

/** Whole Nairobi days from `earlier` to `later` (0 = the same day). */
export const daysBetween = (earlier: Date, later: Date): number =>
  Math.round((dayAsDate(nairobiDay(later)).getTime() - dayAsDate(nairobiDay(earlier)).getTime()) / DAY_MS);

/** "07:42" */
export const clockText = (date: Date): string => {
  const w = wall(date);
  return `${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`;
};

/** "12 Oct" */
export const shortDateText = (date: Date): string => {
  const w = wall(date);
  return `${w.getUTCDate()} ${MONTHS[w.getUTCMonth()]}`;
};

/** "13 Oct 07:12" */
export const dateClockText = (date: Date): string => `${shortDateText(date)} ${clockText(date)}`;

/** "Fri 9 Oct" */
export const weekdayDateText = (date: Date): string => `${WEEKDAYS[wall(date).getUTCDay()]} ${shortDateText(date)}`;

/** "Mon 12 Oct 16:10" */
export const weekdayDateClockText = (date: Date): string => `${weekdayDateText(date)} ${clockText(date)}`;

/** "13 Oct 2026, 09:18" */
export const fullDateClockText = (date: Date): string => `${shortDateText(date)} ${wall(date).getUTCFullYear()}, ${clockText(date)}`;

/** "Today", "Yesterday", "6 days ago", or "Never counted" for a null. Whole Nairobi days, so 23:50 yesterday is "Yesterday". */
export const lastCountedText = (at: Date | null, now: Date): string => {
  if (!at) return 'Never counted';
  const days = daysBetween(at, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
};

/** "Today 07:42", "Yesterday 16:10", else "Mon 12 Oct 16:10": the Counts table's Signed column. */
export const signedText = (at: Date, now: Date): string => {
  const days = daysBetween(at, now);
  if (days === 0) return `Today ${clockText(at)}`;
  if (days === 1) return `Yesterday ${clockText(at)}`;
  return weekdayDateClockText(at);
};

/** True when the instant falls in the quiet hours 22:00 to 05:00 Africa/Nairobi (the Director's push is held until 05:00). */
export const inQuietHours = (date: Date): boolean => {
  const hour = wall(date).getUTCHours();
  return hour >= 22 || hour < 5;
};

/** When a push held for quiet hours goes out: 05:00 Nairobi that morning; the instant itself outside quiet hours. */
export const nextQuietHoursEnd = (date: Date): Date => {
  if (!inQuietHours(date)) return date;
  const w = wall(date);
  const morning = new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate() + (w.getUTCHours() >= 22 ? 1 : 0), 5, 0, 0));
  return new Date(morning.getTime() - NAIROBI_OFFSET_MS);
};
