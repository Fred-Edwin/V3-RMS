/**
 * Leave dates and moments in words. Dates are Nairobi dates (`YYYY-MM-DD`) and are never run through the browser's time zone: they are
 * read as UTC calendar days. Moments are shown in Nairobi time whatever the device says (workforce time rule).
 */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

const toUtc = (date: string): Date => new Date(`${date}T00:00:00Z`);
export const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

/** Today in Nairobi, as a date. */
export function nairobiToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export const dayNumber = (date: string): number => toUtc(date).getUTCDate();
export const weekdayShort = (date: string): string => DAYS[toUtc(date).getUTCDay()] ?? '';
export const monthLong = (date: string): string => MONTHS[toUtc(date).getUTCMonth()] ?? '';
export const monthShort = (date: string): string => monthLong(date).slice(0, 3);
/** The Monday on or before a date. */
export function mondayOf(date: string): string {
  const dow = toUtc(date).getUTCDay();
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

/** "Thu 29 October". */
export const dayLong = (date: string): string => `${weekdayShort(date)} ${dayNumber(date)} ${monthLong(date)}`;
/** "Thu 29 Oct". */
export const daySmall = (date: string): string => `${weekdayShort(date)} ${dayNumber(date)} ${monthShort(date)}`;

/** "Mon 26 to Wed 28 October"; across a month "Fri 30 October to Mon 2 November". */
export function rangeLong(start: string, end: string): string {
  if (start === end) return dayLong(start);
  if (monthLong(start) === monthLong(end)) return `${weekdayShort(start)} ${dayNumber(start)} to ${weekdayShort(end)} ${dayNumber(end)} ${monthLong(end)}`;
  return `${dayLong(start)} to ${dayLong(end)}`;
}

/** "26 to 28 Oct"; across a month "30 Oct to 2 Nov". */
export function rangeShort(start: string, end: string): string {
  if (start === end) return `${dayNumber(start)} ${monthShort(start)}`;
  if (monthLong(start) === monthLong(end)) return `${dayNumber(start)} to ${dayNumber(end)} ${monthShort(end)}`;
  return `${dayNumber(start)} ${monthShort(start)} to ${dayNumber(end)} ${monthShort(end)}`;
}

/** Whole calendar days between two dates, both counted. */
export const countDays = (start: string, end: string): number => Math.round((toUtc(end).getTime() - toUtc(start).getTime()) / 86_400_000) + 1;

const parts = (iso: string, options: Intl.DateTimeFormatOptions): Record<string, string> =>
  Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hourCycle: 'h23', ...options }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));

/** The Nairobi date of a moment. */
export const dateOfMoment = (iso: string): string => nairobiToday(new Date(iso));

/** "Fri 9 Oct, 15:10". */
export function momentLabel(iso: string): string {
  const p = parts(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${p.weekday} ${p.day} ${p.month}, ${p.hour}:${p.minute}`;
}

/** "today 15:10" for today, else `momentLabel`. */
export function momentSince(iso: string, now: Date = new Date()): string {
  const p = parts(iso, { hour: '2-digit', minute: '2-digit' });
  return dateOfMoment(iso) === nairobiToday(now) ? `today ${p.hour}:${p.minute}` : momentLabel(iso);
}

export const plural = (count: number, one: string, many: string = `${one}s`): string => `${count} ${count === 1 ? one : many}`;
export const daysWord = (count: number): string => plural(count, 'day');
