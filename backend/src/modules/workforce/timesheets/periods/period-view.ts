import type { TimesheetStatus } from '@prisma/client';
import { weekStatus } from '../days/day-merge';
import type { DayRow, OvertimeRow } from '../timesheets.types';

export interface PersonFacts {
  id: string;
  name: string;
  departmentId: string | null;
  department: { name: string } | null;
}

export interface PersonPeriodRow {
  employeeId: string;
  name: string;
  departmentId: string | null;
  departmentName: string | null;
  plannedMinutes: number;
  workedMinutes: number;
  lateMinutes: number; // minutes late, as recorded (deductions are slice 6)
  lateDays: number;
  absentDays: number;
  overtimeAuthorisedMinutes: number;
  overtimePendingMinutes: number;
  needsLookDays: number;
  status: TimesheetStatus;
}

export interface PeriodSummary {
  people: number;
  plannedMinutes: number;
  workedMinutes: number;
  overtimeAuthorisedMinutes: number;
  lateMinutes: number;
  lateDays: number;
  absentDays: number;
  /** Days the system approved by itself, and what is still waiting on a person. */
  autoApprovedDays: number;
  needsLookDays: number;
  needsLookPeople: number;
  pendingOvertimeItems: number;
}

export type PeopleFilter = 'ALL' | 'NEEDS_LOOK' | 'LATE';

interface DayWithPerson {
  day: DayRow;
  person: PersonFacts;
}

/** Rule: one row per person with the period's totals; the row's status follows its days (any exception first). */
export function personRows(days: readonly DayWithPerson[], overtime: readonly OvertimeRow[]): PersonPeriodRow[] {
  const byPerson = new Map<string, { person: PersonFacts; days: DayRow[] }>();
  for (const { day, person } of days) {
    const entry = byPerson.get(person.id) ?? { person, days: [] };
    entry.days.push(day);
    byPerson.set(person.id, entry);
  }
  return [...byPerson.values()]
    .map(({ person, days: list }): PersonPeriodRow => {
      const mine = overtime.filter((item) => item.employeeId === person.id);
      const pending = mine.filter((item) => item.status === 'PENDING');
      return {
        employeeId: person.id,
        name: person.name,
        departmentId: person.departmentId,
        departmentName: person.department?.name ?? null,
        plannedMinutes: list.reduce((sum, d) => sum + d.scheduledMinutes, 0),
        workedMinutes: list.reduce((sum, d) => sum + d.workedMinutes, 0),
        lateMinutes: list.reduce((sum, d) => sum + (d.reasons.includes('LATE') || d.lateExcused ? d.minutesLate : 0), 0),
        lateDays: list.filter((d) => d.minutesAfterGrace > 0).length,
        absentDays: list.filter((d) => d.reasons.includes('ABSENT')).length,
        overtimeAuthorisedMinutes: mine.reduce((sum, item) => sum + item.authorisedMinutes, 0),
        overtimePendingMinutes: pending.reduce((sum, item) => sum + item.needsMinutes, 0),
        needsLookDays: list.filter((d) => d.status === 'NEEDS_LOOK' || d.status === 'HELD').length,
        status: weekStatus(list.map((d) => d.status)),
      };
    })
    .sort((a, b) => Number(b.needsLookDays > 0) - Number(a.needsLookDays > 0) || a.name.localeCompare(b.name));
}

export function summarise(rows: readonly PersonPeriodRow[], days: readonly DayWithPerson[], overtime: readonly OvertimeRow[]): PeriodSummary {
  const sum = (pick: (row: PersonPeriodRow) => number): number => rows.reduce((total, row) => total + pick(row), 0);
  return {
    people: rows.length,
    plannedMinutes: sum((r) => r.plannedMinutes),
    workedMinutes: sum((r) => r.workedMinutes),
    overtimeAuthorisedMinutes: sum((r) => r.overtimeAuthorisedMinutes),
    lateMinutes: sum((r) => r.lateMinutes),
    lateDays: sum((r) => r.lateDays),
    absentDays: sum((r) => r.absentDays),
    autoApprovedDays: days.filter(({ day }) => day.status === 'AUTO_APPROVED').length,
    needsLookDays: sum((r) => r.needsLookDays),
    needsLookPeople: rows.filter((r) => r.needsLookDays > 0).length,
    pendingOvertimeItems: overtime.filter((item) => item.status === 'PENDING').length,
  };
}

export function filterRows(rows: readonly PersonPeriodRow[], filter: PeopleFilter, search: string | undefined, departmentId: string | undefined, departmentIds: readonly string[] | null): PersonPeriodRow[] {
  const needle = search?.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (departmentIds === null || (row.departmentId !== null && departmentIds.includes(row.departmentId))) &&
      (!departmentId || row.departmentId === departmentId) &&
      (!needle || row.name.toLowerCase().includes(needle)) &&
      (filter === 'ALL' || (filter === 'NEEDS_LOOK' ? row.needsLookDays > 0 || row.overtimePendingMinutes > 0 : row.lateDays > 0)),
  );
}
