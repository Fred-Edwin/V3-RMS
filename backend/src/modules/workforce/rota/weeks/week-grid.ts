import { fromDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { weekDaysOf } from '../rota-days';
import type { GridDay, GridPerson, RotaWarning, TemplateView, WeekView } from '../rota.types';
import { computeWarnings, type WarnPerson } from '../warnings/warnings';
import type { GridEmployee, GridEntry } from './weeks-repository';

export interface GridFacts {
  siteId: string;
  weekStart: NairobiDate;
  today: NairobiDate;
  employees: readonly GridEmployee[];
  entries: readonly GridEntry[];
  templates: readonly TemplateView[];
  departments: readonly { id: string; name: string; headName: string | null }[];
  leave: ReadonlyMap<string, ReadonlySet<string>>;
  minimumCover: Readonly<Record<string, number>>;
  can: WeekView['can'];
}

const NO_DEPARTMENT = 'No department';

/** Everything the grid shows, worked out from the facts. No database here, so the maths is testable on its own. */
export function assembleWeek(facts: GridFacts): Omit<WeekView, 'cost'> {
  const days = weekDaysOf(facts.weekStart);
  const minutesOf = new Map(facts.templates.map((t) => [t.id, t.paidMinutes] as const));
  const people: GridPerson[] = [];
  const warnPeople: WarnPerson[] = [];

  for (const employee of facts.employees) {
    const cells: GridPerson['cells'] = {};
    const shifts: WarnPerson['shifts'] = {};
    for (const entry of facts.entries.filter((e) => e.employeeId === employee.id)) {
      const date = fromDateColumn(entry.date);
      (cells[date] ??= []).push({ entryId: entry.id, templateId: entry.templateId, overrideReason: entry.overrideReason });
      (shifts[date] ??= []).push(minutesOf.get(entry.templateId) ?? 0);
    }
    const weeklyHours = employee.payProfile?.standardWeekHours;
    const contractMinutes = weeklyHours ? Math.round(Number(weeklyHours) * 60) : null;
    const leaveDates = [...(facts.leave.get(employee.id) ?? [])].sort() as NairobiDate[];
    const planned = Object.values(shifts).flat().reduce((a, b) => a + b, 0);
    people.push({
      employeeId: employee.id,
      name: employee.name,
      departmentId: employee.departmentId,
      positionName: employee.position?.name ?? null,
      cells,
      leaveDates,
      plannedMinutes: planned,
      contractMinutes,
    });
    warnPeople.push({ employeeId: employee.id, name: employee.name, departmentId: employee.departmentId, shifts, leaveDates: new Set(leaveDates), contractMinutes });
  }

  const departments = facts.departments.map((d) => ({ id: d.id as string | null, name: d.name, headName: d.headName }));
  if (people.some((p) => p.departmentId === null)) departments.push({ id: null, name: NO_DEPARTMENT, headName: null });
  const departmentRows = departments.map((d) => {
    const inDepartment = people.filter((p) => p.departmentId === d.id);
    return { ...d, people: inDepartment.length, shifts: inDepartment.reduce((n, p) => n + Object.values(p.cells).flat().length, 0) };
  });

  const gridDays: GridDay[] = days.map((date) => ({
    date,
    isPast: date < facts.today,
    people: people.filter((p) => (p.cells[date] ?? []).length > 0).length,
    byDepartment: Object.fromEntries(
      facts.departments.map((d) => [
        d.id,
        { people: people.filter((p) => p.departmentId === d.id && (p.cells[date] ?? []).length > 0).length, needs: facts.minimumCover[d.id] ?? null },
      ]),
    ),
  }));

  const warnings: RotaWarning[] = computeWarnings({
    people: warnPeople,
    days,
    today: facts.today,
    minimumCover: facts.minimumCover,
    departments: facts.departments,
  });

  return {
    siteId: facts.siteId,
    weekStart: facts.weekStart,
    today: facts.today,
    days: gridDays,
    departments: departmentRows,
    templates: [...facts.templates],
    people,
    totals: {
      people: people.filter((p) => Object.keys(p.cells).length > 0).length,
      shifts: departmentRows.reduce((n, d) => n + d.shifts, 0),
      plannedMinutes: people.reduce((n, p) => n + p.plannedMinutes, 0),
    },
    warnings,
    can: facts.can,
  };
}
