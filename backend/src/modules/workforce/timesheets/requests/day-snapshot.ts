import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { EntryDay, EventRow } from '../../attendance/attendance.types';
import { buildEntryDay } from '../../attendance/days/day-model';
import { attendanceRulesFor } from '../../attendance/days/day-rules';
import { daysRepository } from '../../attendance/days/days-repository';
import { groupDay } from '../../attendance/days/person-day';

export interface DaySnapshot {
  /** The person's shift on that day (the only one; a day with two shifts uses the first). Null when nothing was rostered. */
  entry: EntryDay | null;
  /** The shift's clock events, original rows only, in the order they were made. */
  events: EventRow[];
}

/** One person's day as the clock events stand now, read through the same day model the Today board uses. */
export async function loadSnapshot(siteId: string, employeeId: string, date: NairobiDate, now: Date): Promise<DaySnapshot> {
  const [data, rules] = await Promise.all([daysRepository.loadDayData(siteId, date, date, [employeeId]), attendanceRulesFor(siteId, date)]);
  const groups = groupDay(employeeId, date, data);
  const first = groups.entries[0] ?? null;
  const events = first ? (groups.byEntry.get(first.id) ?? []) : groups.unscheduled;
  return { entry: first ? buildEntryDay(first, events, data.answers.find((a) => a.rotaEntryId === first.id) ?? null, rules, now) : null, events };
}

/** What the system holds for the day, in words a screen can set beside "I say it should be". Times and minutes only. */
export function recordedOf(snapshot: DaySnapshot): Record<string, unknown> {
  const { entry } = snapshot;
  return {
    shift: entry ? { name: entry.templateName, start: entry.shift.startTime, end: entry.shift.endTime } : null,
    clockIn: entry?.clockedInAt?.toISOString() ?? null,
    clockOut: entry?.clockedOutAt?.toISOString() ?? null,
    workedMinutes: entry?.hours.workedMinutes ?? 0,
    minutesLate: entry?.lateness?.minutesLate ?? 0,
    state: entry?.state ?? null,
  };
}
