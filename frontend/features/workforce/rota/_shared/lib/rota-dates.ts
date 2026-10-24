/**
 * Dates on the rota are Nairobi calendar strings ("2026-10-12"); the server does all time maths in Nairobi time, so the screen never
 * reads the device's own time zone except to ask "what is today there". Pure functions, tested.
 */

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

const parts = (date: string): { y: number; m: number; d: number } => {
  const [y, m, d] = date.split('-').map(Number);
  return { y: y ?? 1970, m: m ?? 1, d: d ?? 1 };
};
const stamp = (date: string): number => {
  const { y, m, d } = parts(date);
  return Date.UTC(y, m - 1, d);
};
const text = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export function nairobiToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(date: string, days: number): string {
  return text(stamp(date) + days * DAY_MS);
}

/** 0 = Sunday ... 6 = Saturday. */
const weekdayIndex = (date: string): number => new Date(stamp(date)).getUTCDay();

/** The Monday on or before `date` (the Rules "week starts on" day is Monday by default; the server refuses any other start). */
export function mondayOf(date: string): string {
  const back = (weekdayIndex(date) + 6) % 7;
  return addDays(date, -back);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export const weekdayName = (date: string): string => WEEKDAYS[weekdayIndex(date)] ?? '';
export const dayOfMonth = (date: string): number => parts(date).d;
export const monthName = (date: string): string => MONTHS[parts(date).m - 1] ?? '';

/** "MON 12", the grid's column head. */
export const columnHead = (date: string): string => `${weekdayName(date).slice(0, 3).toUpperCase()} ${dayOfMonth(date)}`;
/** "Tue 13", inside a sentence. */
export const shortDay = (date: string): string => `${weekdayName(date).slice(0, 3)} ${dayOfMonth(date)}`;
/** "Wed 28 Oct", a date in words for a notice or a warning. */
export const dayInWords = (date: string): string => `${weekdayName(date).slice(0, 3)} ${dayOfMonth(date)} ${monthName(date).slice(0, 3)}`;
/** "Saturday 17 October". */
export const longDay = (date: string): string => `${weekdayName(date)} ${dayOfMonth(date)} ${monthName(date)}`;

/** "Mon 12 to Sun 18 October 2026" (the stepper). */
export function weekLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const tail = parts(end);
  return `${shortDay(weekStart)} to ${shortDay(end)} ${monthName(end)} ${tail.y}`;
}

/** "Monday 12 to Sunday 18 October 2026", the printed rota's sub-heading. */
export function weekLongRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  return `${weekdayName(weekStart)} ${dayOfMonth(weekStart)}${parts(weekStart).m === parts(end).m ? '' : ` ${monthName(weekStart)}`} to ${longDay(end)} ${parts(end).y}`;
}

/** "12 to 18 October", or "28 September to 4 October" when the week crosses a month. */
export function weekShortRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const start = parts(weekStart);
  const last = parts(end);
  return start.m === last.m ? `${start.d} to ${last.d} ${monthName(end)}` : `${start.d} ${monthName(weekStart)} to ${last.d} ${monthName(end)}`;
}

/** Mon 12 to Sun 18 October, for a phone line: "Mon 12 to Sun 18 Oct". */
export function weekPhoneRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  return `${shortDay(weekStart)} to ${shortDay(end)} ${monthName(end).slice(0, 3)}`;
}

/** True for a day the server will refuse to change (before today). */
export const isPastDay = (date: string, today: string): boolean => date < today;

/** Today and tomorrow need a reason (REASON_DAYS_AHEAD = 1 on the server). */
export const needsReasonOn = (date: string, today: string): boolean => date >= today && date <= addDays(today, 1);

/** "9 Oct 2026, 16:40" in Nairobi time, for the printed page. */
export function printedStamp(iso: string): string {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  return f.format(new Date(iso)).replace(' at ', ', ');
}

/** "9 October 2026" in Nairobi time. */
export function printedDay(iso: string): string {
  const day = nairobiToday(new Date(iso));
  const { y, m, d } = parts(day);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
