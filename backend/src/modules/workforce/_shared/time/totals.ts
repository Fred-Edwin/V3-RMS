import type { LatenessRules } from '../../rules/rules-schemas';
import { addDays, monthKey, weekStart, type IsoWeekday, type NairobiDate } from './nairobi-time';
import { isInPeriod, type Period } from './periods';
import type { DayHours } from './time-types';

export interface WeekTotal {
  weekStart: NairobiDate;
  weekEnd: NairobiDate;
  partial: boolean; // the week is cut by a period boundary
  scheduledMinutes: number;
  workedMinutes: number;
  afterEndMinutes: number;
  lateDays: number;
  absentDays: number; // NO_CLOCK days
}

export interface PeriodTotal {
  period: Period;
  scheduledMinutes: number;
  workedMinutes: number;
  afterEndMinutes: number;
  lateDays: number;
  absentDays: number;
  weeks: WeekTotal[];
}

const byDate = <T extends { shiftDate: NairobiDate }>(a: T, b: T): number => (a.shiftDate < b.shiftDate ? -1 : a.shiftDate > b.shiftDate ? 1 : 0);

/**
 * Rule: weeks start on the rule's weekStartsOn (Monday by default). Only CLOSED and AUTO_CLOSED days add worked and
 * afterEnd minutes; OPEN days are skipped altogether (still in progress). NO_CLOCK days add scheduled minutes and one
 * absent day (a manager decides whether it is excused; the engine never deducts for it). A late day is one whose
 * lateness.countsAsLate is true. Feeds on: week.weekStartsOn.
 */
export function weeklyTotals(days: readonly DayHours[], weekStartsOn: IsoWeekday): WeekTotal[] {
  const weeks = new Map<NairobiDate, WeekTotal>();
  for (const day of days) {
    if (day.status === 'OPEN') continue;
    const start = weekStart(day.shiftDate, weekStartsOn);
    let week = weeks.get(start);
    if (!week) {
      week = { weekStart: start, weekEnd: addDays(start, 6), partial: false, scheduledMinutes: 0, workedMinutes: 0, afterEndMinutes: 0, lateDays: 0, absentDays: 0 };
      weeks.set(start, week);
    }
    week.scheduledMinutes += day.scheduledMinutes;
    if (day.status === 'NO_CLOCK') {
      week.absentDays += 1;
    } else {
      week.workedMinutes += day.workedMinutes;
      week.afterEndMinutes += day.afterEndMinutes;
      if (day.lateness?.countsAsLate) week.lateDays += 1;
    }
  }
  return [...weeks.values()].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

/** Weeks are cut at the period's start and end. Feeds on: week.weekStartsOn, week.timesheetPeriod. */
export function periodTotals(days: readonly DayHours[], period: Period, weekStartsOn: IsoWeekday): PeriodTotal {
  const weeks = weeklyTotals(
    days.filter((day) => isInPeriod(day.shiftDate, period)),
    weekStartsOn,
  ).map((week) => ({ ...week, partial: week.weekStart < period.start || week.weekEnd > period.end }));
  const sum = (pick: (week: WeekTotal) => number): number => weeks.reduce((total, week) => total + pick(week), 0);
  return {
    period,
    scheduledMinutes: sum((w) => w.scheduledMinutes),
    workedMinutes: sum((w) => w.workedMinutes),
    afterEndMinutes: sum((w) => w.afterEndMinutes),
    lateDays: sum((w) => w.lateDays),
    absentDays: sum((w) => w.absentDays),
    weeks,
  };
}

export interface LateDay {
  shiftDate: NairobiDate;
  countsAsLate: boolean;
  minutesAfterGrace: number;
  excused: boolean;
  madeUpMinutes: number;
}
export interface DeductibleLateness {
  shiftDate: NairobiDate;
  chargeableMinutes: number; // minutes payroll may turn into money (slice 6); the engine does no money
}

/**
 * Rule (proposal 5.6, decision D11). A day is chargeable only when it counts as late, is not excused, and still has
 * minutes after grace once made-up minutes are taken off. Then by policy:
 *   RECORD_ONLY: nothing is chargeable.
 *   FROM_FIRST_MINUTE: every chargeable day is charged its minutes after grace.
 *   AFTER_N_LATES: within each Nairobi calendar month, the first `afterLatesPerMonth` chargeable days are free; later ones are charged.
 * Returns one entry per input day, in date order (0 where nothing is chargeable).
 * Missing a whole shift is never deducted here (only a manager's "unexcused" mark does that, in slice 4).
 * Feeds on: lateness.policy, lateness.afterLatesPerMonth.
 */
export function deductibleLateness(days: readonly LateDay[], rules: Pick<LatenessRules, 'policy' | 'afterLatesPerMonth'>): DeductibleLateness[] {
  const perMonth = new Map<string, number>();
  return [...days].sort(byDate).map((day) => {
    const remaining = day.countsAsLate && !day.excused ? Math.max(0, day.minutesAfterGrace - day.madeUpMinutes) : 0;
    if (remaining === 0 || rules.policy === 'RECORD_ONLY') return { shiftDate: day.shiftDate, chargeableMinutes: 0 };
    if (rules.policy === 'FROM_FIRST_MINUTE') return { shiftDate: day.shiftDate, chargeableMinutes: remaining };
    const key = monthKey(day.shiftDate);
    const seen = (perMonth.get(key) ?? 0) + 1;
    perMonth.set(key, seen);
    return { shiftDate: day.shiftDate, chargeableMinutes: seen > (rules.afterLatesPerMonth ?? 0) ? remaining : 0 };
  });
}
