import type { LatenessRules } from '../../rules/rules-schemas';
import { OvernightShiftError } from '../errors';
import { instantAt, minutesOfDay } from './nairobi-time';
import type { LatenessResult, ShiftWindow } from './time-types';

const MS_PER_MINUTE = 60_000;

/** Throws OvernightShiftError when end is not later than start. */
export function assertNoOvernight(shift: ShiftWindow): void {
  if (minutesOfDay(shift.endTime) <= minutesOfDay(shift.startTime)) throw new OvernightShiftError();
}

export function shiftInstants(shift: ShiftWindow): { start: Date; end: Date } {
  return { start: instantAt(shift.date, shift.startTime), end: instantAt(shift.date, shift.endTime) };
}

/**
 * Rule: minutesLate = floor((clockIn - start) / 1 minute), never below 0. It counts as late only when minutesLate is
 * MORE than lateness.graceMinutes (grace 5: 5 minutes late is recorded as 5 but does not count; 6 counts, with 1 minute
 * after grace). Feeds on: lateness.graceMinutes.
 */
export function computeLateness(shift: ShiftWindow, clockInAt: Date, rules: Pick<LatenessRules, 'graceMinutes'>): LatenessResult {
  const { start } = shiftInstants(shift);
  const diffMinutes = Math.floor((clockInAt.getTime() - start.getTime()) / MS_PER_MINUTE);
  const minutesLate = Math.max(0, diffMinutes);
  const earlyMinutes = diffMinutes < 0 ? Math.floor((start.getTime() - clockInAt.getTime()) / MS_PER_MINUTE) : 0;
  const countsAsLate = minutesLate > rules.graceMinutes;
  return { minutesLate, countsAsLate, minutesAfterGrace: countsAsLate ? minutesLate - rules.graceMinutes : 0, earlyMinutes };
}
