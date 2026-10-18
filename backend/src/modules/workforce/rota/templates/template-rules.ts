import { ValidationError } from '../../../../utils/errors';
import { minutesOfDay, parseClockTime } from '../../_shared/time/nairobi-time';
import type { ShiftColour } from '../rota.constants';
import { paidMinutes } from '../rota-days';
import type { TemplateView } from '../rota.types';
import type { TemplateRecord } from './templates-repository';

export const toTemplateView = (row: TemplateRecord, thisWeek: number): TemplateView => ({
  id: row.id,
  name: row.name,
  letter: row.letter,
  colour: row.colour as ShiftColour,
  startTime: row.startTime,
  endTime: row.endTime,
  unpaidBreakMinutes: row.unpaidBreakMinutes,
  paidMinutes: paidMinutes(row),
  siteId: row.siteId,
  departments: row.departments.map((d) => ({ id: d.department.id, name: d.department.name })),
  isActive: row.isActive,
  retiredAt: row.retiredAt ? row.retiredAt.toISOString() : null,
  thisWeek,
});

/** No overnight shifts (D5): the end is later than the start, and the unpaid break is shorter than the shift. */
export function assertShiftWindow(startTime: string, endTime: string, unpaidBreakMinutes: number): void {
  const start = minutesOfDay(parseClockTime(startTime));
  const end = minutesOfDay(parseClockTime(endTime));
  if (end <= start) throw new ValidationError('A shift must end later than it starts; there are no overnight shifts', 'OVERNIGHT_SHIFT');
  if (unpaidBreakMinutes >= end - start) throw new ValidationError('The unpaid break must be shorter than the shift', 'BREAK_TOO_LONG');
}

export interface TemplateFit {
  siteId: string | null;
  departments: { department: { id: string; name: string } }[];
}
export interface PersonFit {
  siteId: string;
  departmentId: string | null;
  departmentName: string | null;
}

/**
 * Whether a shift can go on this person's day: a site shift only at its site; a shift limited to departments only for
 * those departments. A company-wide shift limited to "Kitchen" fits the Kitchen of every site, so a department also
 * matches by name (case-insensitive).
 */
export function templateFits(template: TemplateFit, person: PersonFit): boolean {
  if (template.siteId !== null && template.siteId !== person.siteId) return false;
  if (template.departments.length === 0) return true;
  if (person.departmentId === null) return false;
  const name = person.departmentName?.toLowerCase() ?? null;
  return template.departments.some((d) => d.department.id === person.departmentId || (name !== null && d.department.name.toLowerCase() === name));
}
