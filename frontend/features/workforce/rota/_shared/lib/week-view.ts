import type { GridDepartment, GridPerson, RotaWarning, WarningCode, WeekView } from '../types/rota-types';
import { shortDay, weekdayName } from './rota-dates';

/** The pure derivations the grid screen draws: who is in the view, what needs a look, the four numbers, the footer row. */

export const ALL_DEPARTMENTS = 'all';

export const peopleIn = (week: WeekView, departmentId: string): GridPerson[] =>
  departmentId === ALL_DEPARTMENTS ? week.people : week.people.filter((p) => p.departmentId === departmentId);

const personDepartment = (week: WeekView, employeeId: string | null): string | null => week.people.find((p) => p.employeeId === employeeId)?.departmentId ?? null;

export function warningsIn(week: WeekView, departmentId: string): RotaWarning[] {
  if (departmentId === ALL_DEPARTMENTS) return week.warnings;
  return week.warnings.filter((w) => (w.departmentId ?? personDepartment(week, w.employeeId)) === departmentId);
}

/** Warnings tied to one person's day (everything but thin cover), keyed "employeeId|date". */
export function cellWarnings(warnings: readonly RotaWarning[]): Map<string, RotaWarning[]> {
  const map = new Map<string, RotaWarning[]>();
  for (const w of warnings) {
    if (w.code === 'THIN_COVERAGE' || !w.employeeId || !w.date) continue;
    const key = `${w.employeeId}|${w.date}`;
    map.set(key, [...(map.get(key) ?? []), w]);
  }
  return map;
}

/** The amber line under a name: weekly hours over the contract, or a double shift. Null when there is nothing to say. */
export function personNote(person: GridPerson, warnings: readonly RotaWarning[]): string | null {
  const mine = warnings.filter((w) => w.employeeId === person.employeeId);
  const hours = mine.find((w) => w.code === 'WEEKLY_HOURS');
  if (hours) return 'Over contract hours';
  const double = mine.find((w) => w.code === 'DOUBLE_SHIFT' && w.date);
  if (double?.date) return `Double shift ${shortDay(double.date)}`;
  return null;
}

const PHRASE: Record<WarningCode, (n: number) => string> = {
  LEAVE: (n) => `${n} on leave`,
  THIN_COVERAGE: (n) => `${n} thin ${n === 1 ? 'day' : 'days'}`,
  WEEKLY_HOURS: (n) => `${n} over hours`,
  DOUBLE_SHIFT: (n) => `${n} double ${n === 1 ? 'shift' : 'shifts'}`,
};

/** "1 on leave, 1 thin day". */
export function warningPhrase(warnings: readonly RotaWarning[]): string {
  const order: WarningCode[] = ['LEAVE', 'DOUBLE_SHIFT', 'WEEKLY_HOURS', 'THIN_COVERAGE'];
  return order
    .map((code) => [code, warnings.filter((w) => w.code === code).length] as const)
    .filter(([, n]) => n > 0)
    .map(([code, n]) => PHRASE[code](n))
    .join(', ');
}

export interface DepartmentStatus {
  text: string;
  tone: 'warning' | 'success' | 'default';
}

/** The word at the right of a department row: "3 need a look", "Thin Sat", "Complete", "Not started". */
export function departmentStatus(week: WeekView, department: GridDepartment): DepartmentStatus {
  if (department.shifts === 0) return { text: 'Not started', tone: 'warning' };
  const mine = warningsIn(week, department.id ?? '');
  if (mine.length === 0) return { text: 'Complete', tone: 'success' };
  const only = mine[0];
  if (mine.length === 1 && only?.code === 'THIN_COVERAGE' && only.date) return { text: `Thin ${weekdayName(only.date).slice(0, 3)}`, tone: 'warning' };
  return { text: `${mine.length} need a look`, tone: 'warning' };
}

export const allStatus = (week: WeekView): DepartmentStatus => (week.warnings.length === 0 ? { text: 'Complete', tone: 'success' } : { text: `${week.warnings.length} need a look`, tone: 'warning' });

export interface WeekNumbers {
  shifts: number;
  people: number;
  needsLook: number;
  lookPhrase: string;
  plannedMinutes: number;
  onLeave: number;
}

export function weekNumbers(week: WeekView, departmentId: string): WeekNumbers {
  const people = peopleIn(week, departmentId);
  const warnings = warningsIn(week, departmentId);
  const shifts = people.reduce((sum, p) => sum + Object.values(p.cells).reduce((n, day) => n + day.length, 0), 0);
  // A week nobody has started is "Not started", not a pile of thin days.
  const started = shifts > 0;
  return {
    shifts,
    people: people.filter((p) => Object.keys(p.cells).length > 0).length,
    needsLook: started ? warnings.length : 0,
    lookPhrase: !started ? 'Not started' : warnings.length === 0 ? 'nothing to check' : warningPhrase(warnings),
    plannedMinutes: people.reduce((sum, p) => sum + p.plannedMinutes, 0),
    onLeave: people.filter((p) => p.leaveDates.some((d) => week.days.some((day) => day.date === d))).length,
  };
}

export interface FooterRow {
  label: string;
  cells: { text: string; tone: 'default' | 'warning' | 'faint' }[];
}

/** "ON, NEEDS 4": people on each day, "3 thin" in amber where the server says cover is thin. */
export function footerRow(week: WeekView, departmentId: string, warnings: readonly RotaWarning[]): FooterRow {
  const all = departmentId === ALL_DEPARTMENTS;
  const needs = all ? null : (week.days.map((d) => d.byDepartment[departmentId]?.needs ?? null).find((n) => n !== null) ?? null);
  const thin = new Map<string, RotaWarning[]>();
  for (const w of warnings) if (w.code === 'THIN_COVERAGE' && w.date) thin.set(w.date, [...(thin.get(w.date) ?? []), w]);
  return {
    label: needs === null ? 'ON' : `ON, NEEDS ${needs}`,
    cells: week.days.map((d) => {
      const n = all ? d.people : (d.byDepartment[departmentId]?.people ?? 0);
      const thinHere = thin.get(d.date);
      // "thin" counts only the department that is thin: on the all-departments view that is the sum of what each thin department has.
      if (thinHere) return { text: `${all ? thinHere.reduce((sum, w) => sum + Number(w.detail.has ?? 0), 0) : n} thin`, tone: 'warning' as const };
      return { text: String(n), tone: n === 0 ? ('faint' as const) : ('default' as const) };
    }),
  };
}

/** The departments a viewer can switch between: those with people on the rota's roster. */
export const listedDepartments = (week: WeekView): GridDepartment[] => week.departments.filter((d) => d.id !== null);
