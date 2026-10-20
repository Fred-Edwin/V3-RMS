import { UnprocessableEntityError } from '../../../../utils/errors';
import { addDays, daysBetween, instantAt, parseClockTime, minutesOfDay, type NairobiDate } from '../../_shared/time/nairobi-time';

/** PD23: a day is at most 16 hours; a head records today and the three days before it, never the future. */
export const MAX_SHIFT_MINUTES = 960;
export const RECORD_WINDOW_DAYS = 3;

export interface ShiftTimes {
  start: string; // 'HH:MM', 24 hour
  end: string; // 'HH:MM'
  endsNextDay?: boolean; // past midnight shows "+1"
}

/** Minutes after midnight of the work date. `endMinute` is over 1440 when the shift ends after midnight. */
export interface Shift {
  startMinute: number;
  endMinute: number;
  minutes: number;
}

export function shiftOf(times: ShiftTimes): Shift {
  const startMinute = minutesOfDay(parseClockTime(times.start));
  const endMinute = minutesOfDay(parseClockTime(times.end)) + (times.endsNextDay === true ? 1440 : 0);
  if (endMinute <= startMinute) throw new UnprocessableEntityError('End must be after start.', 'END_BEFORE_START');
  const minutes = endMinute - startMinute;
  if (minutes > MAX_SHIFT_MINUTES) throw new UnprocessableEntityError('A day cannot be over 16 hours.', 'DAY_TOO_LONG');
  return { startMinute, endMinute, minutes };
}

/** "07:00" for minute 420; "01:30" for minute 1530 (the "+1" is shown by the screen from `endMinute >= 1440`). */
export const clockOfMinute = (minute: number): string => `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

/** The work date must be today or one of the 3 days before it (Nairobi). */
export function assertRecordable(workDate: NairobiDate, today: NairobiDate): void {
  if (workDate > today) throw new UnprocessableEntityError('You cannot record a day that has not happened.', 'DAY_IN_FUTURE');
  if (daysBetween(workDate, today) > RECORD_WINDOW_DAYS) throw new UnprocessableEntityError('This day is more than 3 days ago. Ask your Branch Manager.', 'DAY_TOO_OLD');
}

export interface DatedShift {
  workDate: NairobiDate;
  startMinute: number;
  endMinute: number;
}

const EPOCH = '1970-01-01' as NairobiDate;
const absolute = (s: DatedShift): { from: number; to: number } => {
  const base = daysBetween(EPOCH, s.workDate) * 1440;
  return { from: base + s.startMinute, to: base + s.endMinute };
};

/** Two shifts overlap when each starts before the other ends. A shift that ends at 12:00 and one that starts at 12:00 do not. */
export function overlaps(a: DatedShift, b: DatedShift): boolean {
  const x = absolute(a);
  const y = absolute(b);
  return x.from < y.to && y.from < x.to;
}

/** The other days a shift can reach: the day before (a shift past midnight) and the day itself. A shift of at most 16 hours never reaches day+2. */
export const neighbourDates = (workDate: NairobiDate): NairobiDate[] => [addDays(workDate, -1), workDate, addDays(workDate, 1)];

/** The moment a shift ends (UTC). */
export const shiftEndInstant = (workDate: NairobiDate, endMinute: number): Date => new Date(instantAt(workDate, parseClockTime('00:00')).getTime() + endMinute * 60_000);

/** The first line whose end has not passed yet, or null when the sheet may be sent (PD23). */
export function firstUnfinished<T extends { endMinute: number }>(workDate: NairobiDate, lines: readonly T[], now: Date): T | null {
  return lines.find((line) => shiftEndInstant(workDate, line.endMinute).getTime() > now.getTime()) ?? null;
}
