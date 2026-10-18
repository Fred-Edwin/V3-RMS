/**
 * Clock times as Nairobi shows them. The phone's own zone is never used: a person abroad or a laptop set to UTC must read the same
 * "06:00" the rota says. Kenya has no daylight saving, so a Nairobi time is always +03:00.
 */

const HM = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' });

/** "06:42" for an instant. */
export const hmOf = (iso: string | number | Date): string => HM.format(new Date(iso));

/** "2026-10-12" for an instant. */
export const dateOf = (iso: string | number | Date): string => DATE.format(new Date(iso));

/** The instant a Nairobi date and "HH:MM" mean, as an ISO string the API takes. */
export const instantAt = (date: string, hm: string): string => `${date}T${hm}:00+03:00`;

/** Whole minutes between two instants (b minus a), rounded down. */
export const minutesBetween = (a: string | number, b: string | number): number => Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 60000);

const DAY_WORDS = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', weekday: 'short', day: 'numeric', month: 'short' });
const LONG_DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', weekday: 'long', day: 'numeric', month: 'long' });

/** "Tue 13 Oct" for a Nairobi date. */
export const dayWords = (date: string): string => DAY_WORDS.format(new Date(instantAt(date, '12:00'))).replace(',', '');

/** "Tuesday 13 October" for a Nairobi date. */
export const longDayWords = (date: string): string => LONG_DAY.format(new Date(instantAt(date, '12:00'))).replace(',', '');

/** "Morning" to "MORNING · 06:00 TO 14:00". */
export const shiftLabelOf = (name: string, start: string, end: string): string => `${name.toUpperCase()} · ${start} TO ${end}`;

/** "8 h 2 m" for minutes; "45 m" under an hour. */
export function hoursAndMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} h ${m % 60} m` : `${m} m`;
}

/** "1:52" for seconds, the Undo counter. */
export function undoCount(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The shift pill in the phone bar: "4:12" (hours and minutes on shift). */
export function pillTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}
