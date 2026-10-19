import { addDays, instantAt, parseClockTime, type NairobiDate } from '../../_shared/time/nairobi-time';
import { periodContaining } from '../../_shared/time/periods';
import type { WeekAndBreaksRules } from '../../rules/rules-schemas';

/**
 * The days one timesheet covers: the rule's period (WEEK_AND_BREAKS.timesheetPeriod, a calendar month by default, 1st to
 * last day in Nairobi time). Nothing closes it by itself (Segment 1A): the site's manager approves it once it has ended. The
 * Rules field `timesheetCutoff` is no longer read here (it stays parseable so stored rules stay valid). No day moves between periods.
 */
export interface PeriodWindow {
  start: NairobiDate;
  end: NairobiDate; // the period's last day, inclusive
  label: string; // the rule period's label, e.g. 'October 2026'
  /** The instant the month can first be approved: 00:00 Nairobi on the day after its last day (D6). Stored in the retired `cutoff_at` column. */
  cutoffAt: Date;
}

type Rules = Pick<WeekAndBreaksRules, 'timesheetPeriod'>;

/** Rule: window = the rule period; approvable from the day after the last day. Feeds on: week.timesheetPeriod. */
export function windowForDay(date: NairobiDate, rules: Rules): PeriodWindow {
  const period = periodContaining(date, rules.timesheetPeriod);
  return { start: period.start, end: period.end, label: period.label, cutoffAt: instantAt(addDays(period.end, 1), parseClockTime('00:00')) };
}

/** The window that follows the one ending on `end`. */
export const windowAfter = (window: PeriodWindow, rules: Rules): PeriodWindow => windowForDay(addDays(window.end, 1), rules);
