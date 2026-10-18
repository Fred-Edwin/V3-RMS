import type { GridPerson, TemplateView, WeekView } from '../types/rota-types';
import { weekDates } from './rota-dates';

/** A small week for tests only: Monday 12 October 2026 is "today", so Mon and Tue need a reason. */
export const MORNING: TemplateView = {
  id: 't-morning',
  name: 'Morning',
  letter: 'M',
  colour: 'BLUE',
  startTime: '06:00',
  endTime: '14:00',
  unpaidBreakMinutes: 0,
  paidMinutes: 480,
  organizationId: null,
  departments: [],
  isActive: true,
  retiredAt: null,
  thisWeek: 2,
};

export const AFTERNOON: TemplateView = { ...MORNING, id: 't-afternoon', name: 'Afternoon', letter: 'A', colour: 'GREEN', startTime: '14:00', endTime: '22:00' };

export function person(id: string, name: string, cells: GridPerson['cells'] = {}, extra: Partial<GridPerson> = {}): GridPerson {
  return { employeeId: id, name, departmentId: 'd-barista', positionName: 'Barista', cells, leaveDates: [], plannedMinutes: 0, contractMinutes: null, ...extra };
}

export function weekOf(people: GridPerson[], extra: Partial<WeekView> = {}): WeekView {
  const dates = weekDates('2026-10-12');
  return {
    organizationId: 's-nyeri',
    weekStart: '2026-10-12',
    today: '2026-10-12',
    days: dates.map((date) => ({
      date,
      isPast: false,
      people: people.filter((p) => (p.cells[date] ?? []).length > 0).length,
      byDepartment: { 'd-barista': { people: people.filter((p) => (p.cells[date] ?? []).length > 0).length, needs: 2 } },
    })),
    departments: [{ id: 'd-barista', name: 'Barista', people: people.length, shifts: 2, headName: null }],
    templates: [MORNING, AFTERNOON],
    people,
    totals: { people: people.length, shifts: 2, plannedMinutes: 960 },
    warnings: [],
    cost: null,
    can: { write: true, writeTemplates: true, readCost: false },
    ...extra,
  };
}

export const shift = (templateId: string): { entryId: string; templateId: string; overrideReason: null } => ({ entryId: `e-${templateId}`, templateId, overrideReason: null });
