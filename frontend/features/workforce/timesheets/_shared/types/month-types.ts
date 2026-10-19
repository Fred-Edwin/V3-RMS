/**
 * What the months API sends (`backend/src/modules/workforce/timesheets/months/`, `approval/`, `overtime/`). Dates are Nairobi days
 * ("2026-09-12"); instants are ISO strings. The wire says `organization` where the server code says `site`, so the month's `site`
 * arrives as `organization`. Nothing here is money: payroll decides pay from these minutes.
 */

export type MonthState = 'OPEN' | 'TO_APPROVE' | 'APPROVED';

export interface Signer {
  name: string;
  role: string;
}

export interface MonthListRow {
  monthKey: string;
  label: string;
  state: MonthState;
  workedMinutes: number;
  headcount: number;
  /** The open month only: the hours run to this day, open shifts not counted. */
  soFarThroughDate: string | null;
  plannedSoFarMinutes: number | null;
  needsYouCount: number;
  approvedAt: string | null;
  approvedBy: Signer | null;
  documentNumber: string | null;
}

export interface MonthList {
  /** False while the branch is still on the old clock. */
  enabled: boolean;
  months: MonthListRow[];
  page: number;
  rows: number;
  total: number;
}

export interface NeedsYou {
  clockOutFixes: number;
  overtimeDecisions: number;
  requestsWithManager: number;
  daysToLookAt: number;
  requestsWithHr: number;
  total: number;
}

export interface MonthKpis {
  workedMinutes: number;
  plannedMinutes: number;
  headcount: number;
  overtime: { recordedMinutes: number; approvedMinutes: number; partNotApprovedMinutes: number; toDecideMinutes: number };
  lateCount: number;
  absentDays: number;
}

export interface MonthView {
  monthKey: string;
  label: string;
  organization: { id: string; name: string };
  state: MonthState;
  window: { start: string; end: string };
  range: { from: string; to: string };
  kpis: MonthKpis;
  soFar: { workedMinutes: number; plannedMinutes: number; throughDate: string } | null;
  needsYou: NeedsYou;
  approval: { approvedAt: string; approvedBy: Signer | null; documentNumber: string | null; note: string | null; ownHoursIncluded: boolean } | null;
  rulesUsed: { key: 'LATENESS' | 'OVERTIME'; version: number; effectiveFrom: string | null }[];
  otherSites: { name: string; approved: boolean }[];
  capabilities: { canApprove: boolean; canExport: boolean; canDecide: boolean };
  /** The first day the month can be approved. */
  approvableFrom: string;
}

export type PersonStatus =
  | { kind: 'CLOCK_OUT_FIX'; date: string }
  | { kind: 'OVERTIME_TO_DECIDE'; minutes: number }
  | { kind: 'REQUEST_TO_ANSWER'; date: string }
  | { kind: 'DAY_TO_LOOK_AT'; date: string }
  | { kind: 'SEVERAL'; count: number }
  | { kind: 'OVERTIME_APPROVED'; minutes: number }
  | { kind: 'OVERTIME_APPROVED_PART'; minutes: number }
  | { kind: 'OVERTIME_NOT_APPROVED' }
  | { kind: 'CLOCK_FIX_APPROVED' }
  | { kind: 'ABSENT'; date: string }
  | { kind: 'LEAVE'; days: number }
  | { kind: 'NOTHING' };

export interface MonthPerson {
  employeeId: string;
  name: string;
  departmentId: string | null;
  department: string | null;
  plannedMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  overtimeAuthorisedMinutes: number;
  lateMinutes: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  needsYou: number;
  status: PersonStatus;
}

export interface MonthPeople {
  rows: MonthPerson[];
  total: number;
  page: number;
  pageSize: number;
  counts: { needs: number; late: number; all: number };
}

export type PeopleChip = 'needs' | 'late' | 'all';

export interface MonthQuery {
  from?: string | undefined;
  to?: string | undefined;
}

export interface PeopleQuery extends MonthQuery {
  q?: string | undefined;
  dept?: string | undefined;
  view: PeopleChip;
  sort?: 'department' | 'person' | 'worked' | 'overtime' | 'late';
  dir?: 'asc' | 'desc';
  page: number;
  rows: number;
}

export type DayResultKey =
  | 'REST'
  | 'ON_ROTA'
  | 'LATE'
  | 'LEFT_EARLY'
  | 'OVERTIME_TO_DECIDE'
  | 'OVERTIME_APPROVED'
  | 'OVERTIME_APPROVED_PART'
  | 'OVERTIME_NOT_APPROVED'
  | 'CLOCK_OUT_MISSING'
  | 'ABSENT'
  | 'REQUEST_WAITING'
  | 'EDITED';

export type GlanceKind = 'WORKED' | 'LATE' | 'OVERTIME_TO_DECIDE' | 'REST' | 'ABSENT' | 'NEEDS_LOOK';

export interface PersonTotals {
  plannedMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
}

export interface NeedLookItem {
  date: string;
  kind: 'OVERTIME' | 'CLOCK_OUT_FIX' | 'REQUEST' | 'DAY_LOOK';
  overtimeItemId: string | null;
  requestId: string | null;
  minutes: number | null;
  timeFixAllowed: boolean;
}

export interface LastDay {
  date: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  clockIn: string | null;
  clockOut: string | null;
  resultKey: DayResultKey;
}

export interface Employee {
  id: string;
  name: string;
  role: string | null;
  department: string | null;
}

export interface Neighbours {
  prevEmployeeId: string | null;
  nextEmployeeId: string | null;
}

export interface PersonDrawerData {
  employee: Employee;
  month: { monthKey: string; state: MonthState; start: string; end: string };
  range: { from: string; to: string };
  workingDays: number;
  totals: PersonTotals;
  needLook: NeedLookItem[];
  lastDays: LastDay[];
  neighbours: Neighbours;
  decisions: { date: string; kind: 'OVERTIME'; status: OvertimeStatus; authorisedMinutes: number; extraMinutes: number; byId: string | null; at: string | null }[];
}

export interface PersonDayRow {
  date: string;
  /** 1 = Monday. */
  weekday: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  clockIn: string | null;
  clockOut: string | null;
  extraShifts: { plannedStart: string | null; plannedEnd: string | null; clockIn: string | null; clockOut: string | null }[];
  workedMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  resultKey: DayResultKey;
  needsLook: boolean;
  status: string;
  overtimeItemId: string | null;
  requestId: string | null;
  editedById: string | null;
  beforeEmployment: boolean;
}

export interface PersonDays {
  employee: Employee;
  month: { monthKey: string; state: MonthState; start: string; end: string };
  days: PersonDayRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; needs: number; worked: number };
  glance: { date: string; kind: GlanceKind }[];
  totals: PersonTotals & { absentDays: number; workedDays: number; restDays: number; lateDays: number };
  neighbours: Neighbours;
}

export type OvertimeStatus = 'PENDING' | 'APPROVED' | 'APPROVED_PART' | 'DECLINED' | 'AUTO_AUTHORISED';

export interface OvertimeDetail {
  id: string;
  version: number;
  status: OvertimeStatus;
  shiftDate: string;
  person: Employee;
  organization: { id: string; name: string };
  plannedStart: string | null;
  plannedEnd: string | null;
  workedStart: string | null;
  workedEnd: string | null;
  extraMinutes: number;
  autoMinutes: number;
  authorisedMinutes: number;
  part: { min: number; max: number; step: number } | null;
  evidence: {
    reasonGiven: string | null;
    openWork: { at: string | null; orders: number } | null;
    colleagues: { team: string | null; rostered: number; present: number };
    ordersTaken: number;
    ticketsCleared: number;
    askedInAdvance: boolean;
    headNote: { by: Signer | null; text: string; at: string } | null;
  };
  limits: { weekMinutes: number; weekCapMinutes: number | null; monthMinutes: number; branchWeekMinutes: number; branchBudgetMinutes: number | null; branchUsedMinutes: number };
  decision: { by: Signer | null; at: string; reason: string | null } | null;
  month: { state: 'OPEN' | 'APPROVED' };
  canDecide: boolean;
  canNote: boolean;
}

export type OvertimeChoice = 'APPROVE_ALL' | 'APPROVE_PART' | 'DECLINE';

export interface OvertimeAnswer {
  decision: OvertimeChoice;
  approvedMinutes?: number;
  reason?: string;
  pin: string;
  version: number;
}

export interface ApproveBody {
  pin: string;
  idempotencyKey: string;
  expectedTotals: { workedMinutes: number; overtimeAuthorisedMinutes: number; headcount: number };
  site?: string;
}

export interface ApprovalResult {
  monthKey: string;
  state: 'APPROVED';
  approvedAt: string;
  documentNumber: string;
  documentHashPrefix: string;
  repeat: boolean;
}

export interface ExportRequest {
  format: 'pdf' | 'xlsx';
  scope: 'month' | 'range';
  from?: string;
  to?: string;
  employeeId?: string;
  idempotencyKey: string;
  site?: string;
}

export interface DownloadedFile {
  blob: Blob;
  filename: string;
  documentNumber: string | null;
}
