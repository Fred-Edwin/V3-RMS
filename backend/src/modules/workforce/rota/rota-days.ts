import { ConflictError, ValidationError } from '../../../utils/errors';
import { minutesOfDay, addDays, eachDay, isoWeekday, type ClockTime, type NairobiDate } from '../_shared/time/nairobi-time';
import { getEffectiveRuleGroup } from '../rules/rules-service';
import { REASON_DAYS_AHEAD, REASON_MIN_LENGTH, REASON_MAX_LENGTH } from './rota.constants';

/** Past days are read-only: fixing the past happens in timesheets (Chapter 5). */
export const isPastDay = (date: NairobiDate, today: NairobiDate): boolean => date < today;

/** Today and tomorrow are the days a change needs a reason for. */
export const needsReason = (date: NairobiDate, today: NairobiDate): boolean => date >= today && date <= addDays(today, REASON_DAYS_AHEAD);

/** The paid minutes of a shift: the window minus the unpaid break. The end is always later than the start (no overnight). */
export const paidMinutes = (shift: { startTime: string; endTime: string; unpaidBreakMinutes: number }): number =>
  Math.max(0, minutesOfDay(shift.endTime as ClockTime) - minutesOfDay(shift.startTime as ClockTime) - shift.unpaidBreakMinutes);

export const weekDaysOf = (weekStart: NairobiDate): NairobiDate[] => eachDay(weekStart, addDays(weekStart, 6));

export const weekStartOf = (date: NairobiDate, weekStartsOn: number): NairobiDate => {
  const back = (isoWeekday(date) - weekStartsOn + 7) % 7;
  return addDays(date, -back);
};

/** The week must begin on the day the Week and breaks rule says (Monday unless the Director changed it). */
export async function assertWeekStart(siteId: string, weekStart: NairobiDate): Promise<void> {
  const rule = await getEffectiveRuleGroup(siteId, weekStart, 'WEEK_AND_BREAKS');
  if (isoWeekday(weekStart) !== rule.values.weekStartsOn) {
    throw new ValidationError('A rota week starts on the day set in Rules, Week and breaks', 'WEEK_START_INVALID');
  }
}

/** The reason a change needs when it touches today or tomorrow: trimmed and checked, or a 409 asking for it. */
export function requireReasonWhenNeeded(dates: readonly NairobiDate[], today: NairobiDate, reason: string | undefined): string | null {
  const needed = dates.some((date) => needsReason(date, today));
  const text = reason?.trim() ?? '';
  if (!needed) return text.length > 0 ? text.slice(0, REASON_MAX_LENGTH) : null;
  if (text.length < REASON_MIN_LENGTH) {
    throw new ConflictError('A change to a shift today or tomorrow needs a short reason', 'REASON_REQUIRED', { dates: dates.filter((d) => needsReason(d, today)) });
  }
  return text.slice(0, REASON_MAX_LENGTH);
}
