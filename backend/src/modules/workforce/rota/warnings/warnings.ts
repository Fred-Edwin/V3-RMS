import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { RotaWarning } from '../rota.types';

export interface WarnPerson {
  employeeId: string;
  name: string;
  departmentId: string | null;
  /** date to the paid minutes of each shift that day. */
  shifts: Record<string, number[]>;
  leaveDates: ReadonlySet<string>;
  /** Contract hours for the week in minutes, when the file has them. */
  contractMinutes: number | null;
}

export interface WarnInput {
  people: readonly WarnPerson[];
  days: readonly NairobiDate[];
  today: NairobiDate;
  /** Department id to the fewest people wanted on a day (Rules, Leave, minimum cover). */
  minimumCover: Readonly<Record<string, number>>;
  departments: readonly { id: string; name: string }[];
}

const hours = (minutes: number): number => Math.round((minutes / 60) * 10) / 10;

/**
 * The four warnings of Chapter 5. They only inform: nothing here blocks a save. Thin coverage looks at days from today on
 * (a past day cannot be fixed); the others look at the whole week as planned.
 */
export function computeWarnings(input: WarnInput): RotaWarning[] {
  const warnings: RotaWarning[] = [];
  for (const person of input.people) {
    for (const date of input.days) {
      const shifts = person.shifts[date] ?? [];
      if (shifts.length > 0 && person.leaveDates.has(date)) {
        warnings.push({ code: 'LEAVE', employeeId: person.employeeId, departmentId: person.departmentId, date, message: `${person.name} is on approved leave on ${date}`, detail: {} });
      }
      if (shifts.length > 1) {
        warnings.push({ code: 'DOUBLE_SHIFT', employeeId: person.employeeId, departmentId: person.departmentId, date, message: `${person.name} has ${shifts.length} shifts on ${date}`, detail: { shifts: shifts.length } });
      }
    }
    const planned = input.days.reduce((sum, date) => sum + (person.shifts[date] ?? []).reduce((a, b) => a + b, 0), 0);
    if (person.contractMinutes !== null && planned > person.contractMinutes) {
      warnings.push({
        code: 'WEEKLY_HOURS',
        employeeId: person.employeeId,
        departmentId: person.departmentId,
        date: null,
        message: `${person.name} is planned for ${hours(planned)} h; the contract is ${hours(person.contractMinutes)} h`,
        detail: { plannedHours: hours(planned), contractHours: hours(person.contractMinutes) },
      });
    }
  }
  for (const department of input.departments) {
    const needs = input.minimumCover[department.id] ?? 0;
    if (needs <= 0) continue;
    for (const date of input.days.filter((d) => d >= input.today)) {
      const has = input.people.filter((p) => p.departmentId === department.id && (p.shifts[date] ?? []).length > 0).length;
      if (has < needs) {
        warnings.push({ code: 'THIN_COVERAGE', employeeId: null, departmentId: department.id, date, message: `${department.name} needs ${needs} on ${date}, has ${has}`, detail: { needs, has } });
      }
    }
  }
  return warnings;
}
