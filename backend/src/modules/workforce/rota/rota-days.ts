import { ValidationError } from '../../../utils/errors';
import { minutesOfDay, addDays, eachDay, isoWeekday, type ClockTime, type NairobiDate } from '../_shared/time/nairobi-time';
import { getEffectiveRuleGroup } from '../rules/rules-service';
import { REASON_DAYS_AHEAD, REASON_MAX_LENGTH } from './rota.constants';

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
    throw new ValidationError('A week of shifts starts on the day set in Rules, Week and breaks', 'WEEK_START_INVALID');
  }
}

/**
 * The reason that goes with a change, trimmed, or null when none was given. Owner decision (24 Oct 2026): a reason is optional on every
 * shift change, today and tomorrow included (staff are told either way); only the leave override still requires one.
 */
export function reasonOfChange(reason: string | undefined): string | null {
  const text = reason?.trim() ?? '';
  return text.length > 0 ? text.slice(0, REASON_MAX_LENGTH) : null;
}
