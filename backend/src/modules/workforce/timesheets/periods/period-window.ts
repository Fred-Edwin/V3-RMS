import { addDays, instantAt, parseClockTime, type NairobiDate } from '../../_shared/time/nairobi-time';
import { periodContaining } from '../../_shared/time/periods';
import type { WeekAndBreaksRules } from '../../rules/rules-schemas';

/**
 * The days one timesheet covers. The pay period comes from the rule (WEEK_AND_BREAKS.timesheetPeriod); the timesheet
 * closes `daysBeforePeriodEnd` days before its last day at `time` Nairobi (Chapter 8: "closes by itself on Friday 16
 * October" for a period ending Sunday 18 October). The days after that cut-off belong to the next timesheet, so the
 * window of a period is: the day after the previous cut-off, up to its own cut-off day.
 */
export interface PeriodWindow {
  start: NairobiDate;
  end: NairobiDate; // the cut-off day, inclusive
  label: string; // the rule period's label, e.g. '5 Oct to 18 Oct 2026'
  cutoffAt: Date; // the instant it closes by itself
}

type Rules = Pick<WeekAndBreaksRules, 'timesheetPeriod' | 'timesheetCutoff'>;

const cutoffDayOf = (periodEnd: NairobiDate, rules: Rules): NairobiDate => addDays(periodEnd, -rules.timesheetCutoff.daysBeforePeriodEnd);

/** Rule: window = (previous period's cut-off day + 1) to this period's cut-off day. Feeds on: week.timesheetPeriod, week.timesheetCutoff. */
export function windowOfPeriodContaining(date: NairobiDate, rules: Rules): PeriodWindow {
  const period = periodContaining(date, rules.timesheetPeriod);
  const end = cutoffDayOf(period.end, rules);
  const previous = periodContaining(addDays(period.start, -1), rules.timesheetPeriod);
  return {
    start: addDays(cutoffDayOf(previous.end, rules), 1),
    end,
    label: period.label,
    cutoffAt: instantAt(end, parseClockTime(rules.timesheetCutoff.time)),
  };
}

/** The timesheet a day counts in: a day after its period's cut-off counts in the next period. */
export function windowForDay(date: NairobiDate, rules: Rules): PeriodWindow {
  const own = windowOfPeriodContaining(date, rules);
  if (date <= own.end) return own;
  return windowOfPeriodContaining(addDays(periodContaining(date, rules.timesheetPeriod).end, 1), rules);
}

/** The window that follows the one ending on `end`. */
export const windowAfter = (window: PeriodWindow, rules: Rules): PeriodWindow => windowForDay(addDays(window.end, 1), rules);
