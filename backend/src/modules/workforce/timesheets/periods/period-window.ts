import { addDays, instantAt, parseClockTime, type NairobiDate } from '../../_shared/time/nairobi-time';
import { periodContaining } from '../../_shared/time/periods';
import type { WeekAndBreaksRules } from '../../rules/rules-schemas';

/**
 * The days one timesheet covers: the rule's period (WEEK_AND_BREAKS.timesheetPeriod, a calendar month by default, 1st to
 * last day in Nairobi time). It closes by itself `daysAfterPeriodEnd` days after its last day at `time` Nairobi (October
 * closes on 2 Nov at 18:00), so the last days are complete when a manager reviews. No day moves between periods.
 */
export interface PeriodWindow {
  start: NairobiDate;
  end: NairobiDate; // the period's last day, inclusive
  label: string; // the rule period's label, e.g. 'October 2026'
  cutoffAt: Date; // the instant it closes by itself
}

type Rules = Pick<WeekAndBreaksRules, 'timesheetPeriod' | 'timesheetCutoff'>;

/** Rule: window = the rule period; cut-off = last day + daysAfterPeriodEnd at `time` Nairobi. Feeds on: week.timesheetPeriod, week.timesheetCutoff. */
export function windowForDay(date: NairobiDate, rules: Rules): PeriodWindow {
  const period = periodContaining(date, rules.timesheetPeriod);
  return {
    start: period.start,
    end: period.end,
    label: period.label,
    cutoffAt: instantAt(addDays(period.end, rules.timesheetCutoff.daysAfterPeriodEnd), parseClockTime(rules.timesheetCutoff.time)),
  };
}

/** The window that follows the one ending on `end`. */
export const windowAfter = (window: PeriodWindow, rules: Rules): PeriodWindow => windowForDay(addDays(window.end, 1), rules);
