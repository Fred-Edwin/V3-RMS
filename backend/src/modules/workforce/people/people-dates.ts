import { addDays, parseNairobiDate, type NairobiDate } from '../_shared/time/nairobi-time';
import { EXIT_UNDO_DAYS } from './people.constants';

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/** Same day of the month, clamped to the last day of a shorter month (31 Jan plus one month is 28 Feb). */
export function addMonths(date: NairobiDate, months: number): NairobiDate {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return parseNairobiDate(`${pad(targetYear, 4)}-${pad(targetMonth)}-${pad(Math.min(day, lastDay))}`);
}

/** The probation end for a start date and the rule's months; null when the rule gives none. */
export const probationEnd = (start: NairobiDate, months: number): NairobiDate | null => (months > 0 ? addMonths(start, months) : null);

/** The last day an exit can be undone: the last day plus EXIT_UNDO_DAYS (31 Oct gives 7 Nov). */
export const undoUntil = (lastDay: NairobiDate): NairobiDate => addDays(lastDay, EXIT_UNDO_DAYS);
export const canUndoExit = (lastDay: NairobiDate, today: NairobiDate): boolean => today <= undoUntil(lastDay);

/** An acting head covers until the day before they return. */
export const actingEndsOn = (returnsOn: NairobiDate): NairobiDate => addDays(returnsOn, -1);
