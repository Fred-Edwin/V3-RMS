/** What the Rota endpoints send and take (backend `modules/workforce/rota`). Dates are Nairobi calendar strings, "2026-10-12". */

export type ShiftColour = 'BLUE' | 'GREEN' | 'AMBER' | 'VIOLET' | 'ROSE' | 'GREY';

export interface TemplateView {
  id: string;
  name: string;
  letter: string | null;
  colour: ShiftColour;
  startTime: string;
  endTime: string;
  unpaidBreakMinutes: number;
  paidMinutes: number;
  /** Null = company-wide. The wire says `organization` for a site (requests may say `siteId`). */
  organizationId: string | null;
  /** Empty = every department. */
  departments: { id: string; name: string }[];
  isActive: boolean;
  retiredAt: string | null;
  /** Shifts on this site's rota in the week asked for (the list read only). */
  thisWeek: number;
}

export type WarningCode = 'LEAVE' | 'THIN_COVERAGE' | 'WEEKLY_HOURS' | 'DOUBLE_SHIFT';

export interface RotaWarning {
  code: WarningCode;
  employeeId: string | null;
  departmentId: string | null;
  date: string | null;
  message: string;
  detail: Record<string, number | string>;
}

export interface GridShift {
  entryId: string;
  templateId: string;
  overrideReason: string | null;
}

export interface GridPerson {
  employeeId: string;
  name: string;
  departmentId: string | null;
  positionName: string | null;
  cells: Record<string, GridShift[]>;
  leaveDates: string[];
  plannedMinutes: number;
  contractMinutes: number | null;
}

export interface GridDay {
  date: string;
  isPast: boolean;
  people: number;
  byDepartment: Record<string, { people: number; needs: number | null }>;
}

export interface GridDepartment {
  id: string | null;
  name: string;
  people: number;
  shifts: number;
  headName: string | null;
}

export interface WeekView {
  organizationId: string;
  weekStart: string;
  today: string;
  days: GridDay[];
  departments: GridDepartment[];
  templates: TemplateView[];
  people: GridPerson[];
  totals: { people: number; shifts: number; plannedMinutes: number };
  warnings: RotaWarning[];
  cost: { amount: string; basis: string } | null;
  can: { write: boolean; writeTemplates: boolean; readCost: boolean };
}

export interface CellChange {
  employeeId: string;
  date: string;
  /** The shifts the day ends up with; empty is a day off. */
  templateIds: string[];
}

export interface WriteReasons {
  /** Needed for a change to today or tomorrow (3 to 200 characters). */
  reason?: string;
  /** Needed to keep a shift on an approved-leave day. */
  overrideReason?: string;
}

export interface SetCellsBody extends WriteReasons {
  siteId?: string;
  changes: CellChange[];
}

export interface FillBody extends WriteReasons {
  siteId?: string;
  employeeIds: string[];
  dates: string[];
  /** Null is a day off. */
  templateId: string | null;
}

export interface ApplyResult {
  changedCells: number;
  peopleAffected: number;
  leaveOverrides: number;
}

export type ClashKind = 'ON_LEAVE' | 'LOANED_OUT' | 'NOT_EMPLOYED' | 'SHIFT_UNAVAILABLE';

export interface Clash {
  employeeId: string;
  name: string;
  date: string;
  kind: ClashKind;
  detail: string | null;
}

export interface CopyBody {
  siteId?: string;
  weekStart: string;
  departmentId?: string;
  reason?: string;
}

export interface CopyPreview {
  weekStart: string;
  copiedFrom: string;
  shiftsCopied: number;
  people: number;
  kept: number;
  skippedPast: number;
  clashes: Clash[];
  reasonRequired: boolean;
}

export interface CopyResult extends ApplyResult {
  clashes: Clash[];
  kept: number;
}

export interface TemplateBody {
  /** Null = company-wide (HR and the Director). */
  siteId: string | null;
  name: string;
  letter?: string;
  colour: ShiftColour;
  startTime: string;
  endTime: string;
  unpaidBreakMinutes: number;
  departmentIds: string[];
}

export interface TemplateUpdateBody {
  name?: string;
  letter?: string | null;
  colour?: ShiftColour;
  startTime?: string;
  endTime?: string;
  unpaidBreakMinutes?: number;
  departmentIds?: string[];
  reason?: string;
}

export interface PrintCell {
  code: string;
  name: string;
  colour: ShiftColour;
  startTime: string;
  endTime: string;
}

export interface PrintedRota {
  organizationName: string;
  weekStart: string;
  weekEnd: string;
  printedBy: string;
  printedAt: string;
  days: { date: string }[];
  key: TemplateView[];
  departments: {
    id: string | null;
    name: string;
    headName: string | null;
    people: { name: string; positionName: string | null; plannedMinutes: number; days: Record<string, PrintCell[]>; leaveDates: string[] }[];
    perDay: Record<string, number>;
  }[];
}

export interface MyShift {
  entryId: string;
  date: string;
  shiftName: string;
  letter: string | null;
  colour: ShiftColour;
  startTime: string;
  endTime: string;
  unpaidBreakMinutes: number;
  paidMinutes: number;
}

export interface MyShifts {
  from: string;
  to: string;
  shifts: MyShift[];
}
