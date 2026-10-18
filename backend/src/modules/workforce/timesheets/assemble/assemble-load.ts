import { eachDay, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AttendanceRuleSet, DayData, PersonDay, PersonRow } from '../../attendance/attendance.types';
import { buildPersonDay } from '../../attendance/days/person-day';
import { evidenceRepository } from '../overtime/evidence-repository';
import { NO_EVIDENCE, type ShiftEvidence } from './assemble-plan';

/** Every (person, day) that has a rostered shift or any clock event in the data. */
export function personDaysOf(people: readonly PersonRow[], data: DayData, from: NairobiDate, to: NairobiDate, rules: AttendanceRuleSet, now: Date): PersonDay[] {
  const active = new Map<string, Set<NairobiDate>>();
  const mark = (employeeId: string, date: NairobiDate): void => {
    const set = active.get(employeeId) ?? new Set<NairobiDate>();
    set.add(date);
    active.set(employeeId, set);
  };
  for (const entry of data.entries) mark(entry.employeeId, entry.date);
  for (const event of data.events) mark(event.employeeId, event.shiftDate);

  const days: PersonDay[] = [];
  for (const person of people) {
    const dates = active.get(person.id);
    if (!dates) continue;
    for (const date of eachDay(from, to)) {
      if (dates.has(date)) days.push(buildPersonDay(person, date, data, rules, now));
    }
  }
  return days;
}

/**
 * What each person was doing in the time after a shift ended, for the shifts that ran past the end by more than the
 * grace. One read per such shift; a normal week asks for none.
 */
export async function evidenceFor(siteId: string, days: readonly PersonDay[], graceMinutes: number): Promise<Map<string, ShiftEvidence>> {
  const wanted = days.flatMap((day) =>
    day.entries
      .filter((entry) => entry.hours.afterEndMinutes > graceMinutes && entry.hours.lastClockOut !== null && day.person.userId !== null)
      .map((entry) => ({ entryId: entry.entryId, userId: day.person.userId as string, endsAt: entry.endsAt, leftAt: entry.hours.lastClockOut as Date })),
  );
  const found = await Promise.all(wanted.map(async (w) => [w.entryId, await evidenceRepository.counts(siteId, w.userId, w.endsAt, w.leftAt)] as const));
  return new Map<string, ShiftEvidence>(found.map(([entryId, counts]) => [entryId, { ...NO_EVIDENCE, ...counts }]));
}
