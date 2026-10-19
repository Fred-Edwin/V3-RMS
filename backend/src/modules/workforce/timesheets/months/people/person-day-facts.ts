import type { NairobiDate } from '../../../_shared/time/nairobi-time';
import type { AttendanceRuleSet, DayData } from '../../../attendance/attendance.types';
import { buildEntryDay } from '../../../attendance/days/day-model';
import { groupDay } from '../../../attendance/days/person-day';

/** What the clock says about one person's day, beside what the rota promised. */
export interface PersonDayFacts {
  plannedStart: string | null;
  plannedEnd: string | null;
  clockIn: string | null;
  clockOut: string | null;
  /** Another shift on the same day (the row shows two time pairs). */
  extraShifts: { plannedStart: string; plannedEnd: string; clockIn: string | null; clockOut: string | null }[];
  /** The manager or head who touched the day, if anyone did. */
  editedById: string | null;
}

/** Pure: one person's already-loaded day data in, one entry per asked day with a rostered shift out. */
export function dayFactsOf(employeeId: string, dates: readonly NairobiDate[], data: DayData, rules: AttendanceRuleSet, now: Date): Map<string, PersonDayFacts> {
  const out = new Map<string, PersonDayFacts>();
  for (const date of dates) {
    const groups = groupDay(employeeId, date, data);
    const days = groups.entries.map((entry) => ({ entry, day: buildEntryDay(entry, groups.byEntry.get(entry.id) ?? [], data.answers.find((a) => a.rotaEntryId === entry.id) ?? null, rules, now) }));
    const first = days[0];
    if (!first) continue;
    out.set(date, {
      plannedStart: first.entry.startTime,
      plannedEnd: first.entry.endTime,
      clockIn: first.day.clockedInAt?.toISOString() ?? null,
      clockOut: first.day.clockedOutAt?.toISOString() ?? null,
      extraShifts: days.slice(1).map(({ entry, day }) => ({ plannedStart: entry.startTime, plannedEnd: entry.endTime, clockIn: day.clockedInAt?.toISOString() ?? null, clockOut: day.clockedOutAt?.toISOString() ?? null })),
      editedById: days.find(({ day }) => day.flags.fixed)?.day.flags.recordedForBy ?? null,
    });
  }
  return out;
}
