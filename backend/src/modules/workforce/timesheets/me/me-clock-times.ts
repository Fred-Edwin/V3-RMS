import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { AttendanceRuleSet, DayData } from '../../attendance/attendance.types';
import { buildEntryDay } from '../../attendance/days/day-model';
import { attendanceRulesFor } from '../../attendance/days/day-rules';
import { daysRepository } from '../../attendance/days/days-repository';
import { groupDay } from '../../attendance/days/person-day';

export interface DayClockTimes {
  clockIn: string | null;
  clockOut: string | null;
}

/**
 * The first shift's clock-in and clock-out of each day, as the day model reads them now (corrections applied, voided events gone).
 * Pure: one person's already-loaded day data in, one entry per asked day out. A day with no rostered shift has no entry.
 */
export function clockTimesOf(employeeId: string, dates: readonly NairobiDate[], data: DayData, rules: AttendanceRuleSet, now: Date): Map<string, DayClockTimes> {
  const out = new Map<string, DayClockTimes>();
  for (const date of dates) {
    const groups = groupDay(employeeId, date, data);
    const first = groups.entries[0];
    if (!first) continue;
    const entry = buildEntryDay(first, groups.byEntry.get(first.id) ?? [], data.answers.find((a) => a.rotaEntryId === first.id) ?? null, rules, now);
    out.set(date, { clockIn: entry.clockedInAt?.toISOString() ?? null, clockOut: entry.clockedOutAt?.toISOString() ?? null });
  }
  return out;
}

/** One read for the whole range, then the days. The phone's My time shows "05:58 → 14:01" and Report a problem shows what was recorded. */
export async function clockTimesFor(siteId: string, employeeId: string, from: NairobiDate, to: NairobiDate, dates: readonly NairobiDate[], now: Date): Promise<Map<string, DayClockTimes>> {
  if (dates.length === 0) return new Map();
  const [data, rules] = await Promise.all([daysRepository.loadDayData(siteId, from, to, [employeeId]), attendanceRulesFor(siteId, to)]);
  return clockTimesOf(employeeId, dates, data, rules, now);
}
