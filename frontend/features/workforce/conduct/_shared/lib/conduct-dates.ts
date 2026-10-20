/**
 * Dates on Conduct screens, always in Nairobi time whatever the phone's own zone is (spec section 0). Short form "Fri 9 Oct, 16:42";
 * documents and file rows use "9 October 2026". The server sends instants; the day names are made here with the zone fixed.
 */
const ZONE = 'Africa/Nairobi';
const part = (date: Date, options: Intl.DateTimeFormatOptions): string => new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, ...options }).format(date);
const asDate = (value: string | Date): Date => (value instanceof Date ? value : new Date(value.length === 10 ? `${value}T12:00:00+03:00` : value));

/** "Fri 9 Oct". */
export const shortDay = (value: string | Date): string => part(asDate(value), { weekday: 'short', day: 'numeric', month: 'short' });

/** "16:42". */
export const clockTime = (value: string | Date): string => part(asDate(value), { hour: '2-digit', minute: '2-digit', hour12: false });

/** "Fri 9 Oct, 16:42". */
export const shortDayTime = (value: string | Date): string => `${shortDay(value)}, ${clockTime(value)}`;

/** "9 Oct 2026". */
export const dayMonthYear = (value: string | Date): string => part(asDate(value), { day: 'numeric', month: 'short', year: 'numeric' });

/** "9 October 2026". */
export const longDate = (value: string | Date): string => part(asDate(value), { day: 'numeric', month: 'long', year: 'numeric' });

/** "9 Oct": the issued column in the desk table. */
export const dayMonth = (value: string | Date): string => part(asDate(value), { day: 'numeric', month: 'short' });

/** "September 2026" from "2026-09". */
export const monthYear = (monthKey: string): string => part(new Date(`${monthKey}-15T12:00:00+03:00`), { month: 'long', year: 'numeric' });

/** "Wed 2 Sep" for a facts row (a date-only string). */
export const factsDay = (date: string): string => shortDay(date);

/** "06:06" from a stored clock time (an ISO instant or already "06:06"). */
export const factsClock = (value: string | null): string => (value ? (value.length <= 5 ? value : clockTime(value)) : '—');

/** Whole calendar months from the issue day to the end day ("6 months"): the staff detail does not send the count, the two dates give it. */
export function monthsBetween(issuedAt: string | Date, validUntil: string | Date): number {
  const [y1, m1, d1] = nairobiDay(issuedAt).split('-').map(Number);
  const [y2, m2, d2] = nairobiDay(validUntil).split('-').map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  // An end date clamped to month end (31 Jan + 1 month = 28 Feb) still counts the month.
  const whole = (y2 - y1) * 12 + (m2 - m1);
  return d2 >= d1 || d2 >= 28 ? whole : whole - 1;
}

/** The Nairobi calendar day of an instant, "2026-10-09": used to compare days without server-local time. */
export const nairobiDay = (value: string | Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(asDate(value));
