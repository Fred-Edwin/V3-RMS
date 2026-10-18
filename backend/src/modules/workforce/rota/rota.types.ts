import type { NairobiDate } from '../_shared/time/nairobi-time';
import type { ShiftColour } from './rota.constants';

/** What a shift template looks like to every caller. */
export interface TemplateView {
  id: string;
  name: string;
  letter: string | null;
  colour: ShiftColour;
  startTime: string;
  endTime: string;
  unpaidBreakMinutes: number;
  paidMinutes: number;
  /** Null = company-wide. */
  siteId: string | null;
  /** Empty = every department. */
  departments: { id: string; name: string }[];
  isActive: boolean;
  retiredAt: string | null;
  /** Shifts on this site's rota in the week asked for (templates list only). */
  thisWeek: number;
}

export type WarningCode = 'LEAVE' | 'THIN_COVERAGE' | 'WEEKLY_HOURS' | 'DOUBLE_SHIFT';

/** A warning only informs. It never blocks a save. */
export interface RotaWarning {
  code: WarningCode;
  employeeId: string | null;
  departmentId: string | null;
  date: NairobiDate | null;
  message: string;
  /** Machine-readable detail for the screen: needs and has, hours and contract hours. */
  detail: Record<string, number | string>;
}

export interface GridShift {
  entryId: string;
  templateId: string;
  /** Why a warned cell was kept (approved leave). */
  overrideReason: string | null;
}

export interface GridPerson {
  employeeId: string;
  name: string;
  departmentId: string | null;
  positionName: string | null;
  /** date to that day's shifts (usually zero or one, two for a double shift). */
  cells: Record<string, GridShift[]>;
  /** Days the person is on approved leave (greyed). Slice 5 fills it. */
  leaveDates: NairobiDate[];
  plannedMinutes: number;
  /** The contract's weekly hours, when the file has them. */
  contractMinutes: number | null;
}

export interface GridDay {
  date: NairobiDate;
  isPast: boolean;
  /** People with at least one shift that day, in the whole grid and per department. */
  people: number;
  byDepartment: Record<string, { people: number; needs: number | null }>;
}

export interface WeekView {
  siteId: string;
  weekStart: NairobiDate;
  today: NairobiDate;
  days: GridDay[];
  departments: { id: string | null; name: string; people: number; shifts: number; headName: string | null }[];
  templates: TemplateView[];
  people: GridPerson[];
  totals: { people: number; shifts: number; plannedMinutes: number };
  warnings: RotaWarning[];
  /** Only for a caller who may read pay. Absent otherwise, not zero. */
  cost: { amount: string; basis: string } | null;
  /** What the caller may do, so the screen hides what is not theirs. */
  can: { write: boolean; writeTemplates: boolean; readCost: boolean };
}

/** One change to one person's day, as the writers and the batcher share it. */
export interface CellChange {
  employeeId: string;
  date: NairobiDate;
  /** The shifts the day ends up with (empty = day off). */
  templateIds: string[];
}

export interface PersonChange {
  siteId: string;
  employeeId: string;
  userId: string | null;
  date: NairobiDate;
  changedById: string;
}
