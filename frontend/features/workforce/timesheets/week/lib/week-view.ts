import type { ValueTone } from '../../../_shared';
import { hmOf } from '../../../attendance';
import { mondayOf } from '../../../rota';
import { hm } from '../../_shared/lib/timesheet-words';
import type { Day, Overtime, PersonPeriod, Week } from '../../_shared/types/timesheet-types';

/** A person's period cut into the weeks the timesheet shows (Paper Chapter 8, step 2). Pure. */

export interface WeekWithDays {
  week: Week;
  days: Day[];
}

export const needsPerson = (day: Day): boolean => day.status === 'NEEDS_LOOK' || day.status === 'HELD';

/** Weeks in order, each with the days that fall in it (a part week holds only this month's days). Weeks with no days are dropped. */
export function weeksWithDays(person: PersonPeriod): WeekWithDays[] {
  return [...person.weeks]
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .map((week) => ({ week, days: person.days.filter((d) => mondayOf(d.shiftDate) === week.weekStart).sort((a, b) => a.shiftDate.localeCompare(b.shiftDate)) }))
    .filter((w) => w.days.length > 0);
}

/** The week to open on: the first with something to decide, else the latest that has started, else the first. */
export function defaultWeekIndex(weeks: readonly WeekWithDays[], today: string): number {
  const needs = weeks.findIndex((w) => w.days.some(needsPerson));
  if (needs >= 0) return needs;
  let started = -1;
  weeks.forEach((w, i) => {
    if (w.week.weekStart <= today) started = i;
  });
  return Math.max(0, started);
}

/** The words after a day: "Approved by the system", "Approved · 5 min late, recorded", "Needs you". */
export function dayStatus(day: Day): { text: string; tone: ValueTone } {
  switch (day.status) {
    case 'AUTO_APPROVED':
      return day.minutesAfterGrace > 0 ? { text: `Approved · ${day.minutesLate} min late, recorded`, tone: 'success' } : { text: 'Approved by the system', tone: 'success' };
    case 'MATCHED':
      return { text: 'Matches the rota so far', tone: 'muted' };
    case 'APPROVED':
      return { text: 'Approved', tone: 'success' };
    case 'EXCUSED':
      return { text: 'Lateness excused', tone: 'success' };
    case 'HELD':
      return { text: 'Held back', tone: 'warning' };
    default:
      return { text: 'Needs you', tone: 'warning' };
  }
}

/** "14:02 → 22:01" in Nairobi time, or "14:02 → …" while the shift is open; null when there was no clock-in (the API sends none, or nobody clocked). */
export const dayRange = (day: Day): string | null => (day.clockIn ? `${hmOf(day.clockIn)} → ${day.clockOut ? hmOf(day.clockOut) : '…'}` : null);

/** "8 h 03 of 8 h 00": a day's worked time against the plan, or "Off" for a day with neither. */
export const dayHours = (day: Day): string => (day.scheduledMinutes === 0 && day.workedMinutes === 0 ? 'Off' : `${hm(day.workedMinutes)} of ${hm(day.scheduledMinutes)}`);

/** The overtime on a day, if any. */
export const overtimeOn = (person: PersonPeriod, day: Day): Overtime | null => person.overtime.find((o) => o.shiftDate === day.shiftDate) ?? null;

/** "6 of 7 days matched the rota and were approved by the system. Nothing for you to approve there." Null when nothing was approved that way. */
export function systemLine(days: readonly Day[]): string | null {
  const auto = days.filter((d) => d.status === 'AUTO_APPROVED').length;
  if (auto === 0) return null;
  return `${auto} of ${days.length} ${days.length === 1 ? 'day' : 'days'} matched the rota and ${auto === 1 ? 'was' : 'were'} approved by the system. Nothing for you to approve there.`;
}
