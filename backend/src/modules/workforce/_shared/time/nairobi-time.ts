import { formatDateOnly, parseDateOnly } from '../../../../utils/date-only';
import { ValidationError } from '../../../../utils/errors';

export type NairobiDate = string & { readonly __brand: 'NairobiDate' }; // 'YYYY-MM-DD'
export type ClockTime = string & { readonly __brand: 'ClockTime' }; // 'HH:MM', 00:00 to 23:59
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = Monday

/** Nairobi is UTC+3 all year. Plain arithmetic on this offset keeps every result independent of the server's zone. */
export const NAIROBI_OFFSET_MINUTES = 180 as const;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const OFFSET_MS = NAIROBI_OFFSET_MINUTES * MS_PER_MINUTE;

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');
const formatUtcDate = (ms: number): NairobiDate => {
  const date = new Date(ms);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` as NairobiDate;
};
const utcMsOf = (date: NairobiDate): number => {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
};

export function parseNairobiDate(value: string): NairobiDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new ValidationError(`Not a date (use YYYY-MM-DD): ${value}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new ValidationError(`Not a real date: ${value}`);
  }
  return value as NairobiDate;
}

export function parseClockTime(value: string): ClockTime {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new ValidationError(`Not a time (use HH:MM, 00:00 to 23:59): ${value}`);
  return value as ClockTime;
}

/** The Nairobi calendar day an instant falls on. */
export function nairobiDateOf(instant: Date): NairobiDate {
  return formatUtcDate(instant.getTime() + OFFSET_MS);
}

export function nairobiClockOf(instant: Date): ClockTime {
  const shifted = new Date(instant.getTime() + OFFSET_MS);
  return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}` as ClockTime;
}

export function nairobiToday(now: Date): NairobiDate {
  return nairobiDateOf(now);
}

export function minutesOfDay(time: ClockTime): number {
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  return hours * 60 + minutes;
}

/** The UTC instant at which that Nairobi date and clock time happens. */
export function instantAt(date: NairobiDate, time: ClockTime): Date {
  return new Date(utcMsOf(date) + minutesOfDay(time) * MS_PER_MINUTE - OFFSET_MS);
}

export function addDays(date: NairobiDate, days: number): NairobiDate {
  return formatUtcDate(utcMsOf(date) + days * MS_PER_DAY);
}

export function daysBetween(from: NairobiDate, to: NairobiDate): number {
  return Math.round((utcMsOf(to) - utcMsOf(from)) / MS_PER_DAY);
}

export function eachDay(from: NairobiDate, to: NairobiDate): NairobiDate[] {
  const days: NairobiDate[] = [];
  for (let current = from; current <= to; current = addDays(current, 1)) days.push(current);
  return days;
}

export function isoWeekday(date: NairobiDate): IsoWeekday {
  const day = new Date(utcMsOf(date)).getUTCDay();
  return (day === 0 ? 7 : day) as IsoWeekday;
}

/** The first day of the week containing `date`, for a week that starts on `weekStartsOn` (rule WEEK_AND_BREAKS). */
export function weekStart(date: NairobiDate, weekStartsOn: IsoWeekday): NairobiDate {
  const back = (isoWeekday(date) - weekStartsOn + 7) % 7;
  return addDays(date, -back);
}

export function monthKey(date: NairobiDate): string {
  return date.slice(0, 7);
}

/** Bridges to the @db.Date convention of utils/date-only.ts (a UTC-midnight Date whose calendar day is the Nairobi date). */
export function toDateColumn(date: NairobiDate): Date {
  return parseDateOnly(date);
}

export function fromDateColumn(value: Date): NairobiDate {
  return formatDateOnly(value) as NairobiDate;
}
