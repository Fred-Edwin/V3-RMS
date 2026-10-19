/**
 * What the Timesheets API sends (`backend/src/modules/workforce/timesheets/`). Dates are Nairobi days ("2026-10-12"); instants are ISO
 * strings. The wire says `organization` where the server code says `site`, so `siteId` arrives as `organizationId` and the report's
 * `site` (the branch name) as `organization`. Nothing here is money: pay is decided by payroll from these minutes.
 */

export type DayReason =
  | 'LATE'
  | 'LEFT_EARLY'
  | 'ABSENT'
  | 'EDITED'
  | 'AUTO_CLOSED'
  | 'OPEN_SHIFT'
  | 'PHONE_CLOCK'
  | 'UNSCHEDULED'
  | 'OVERTIME'
  | 'CHANGED_AFTER_APPROVAL';

export type DayStatus = 'MATCHED' | 'AUTO_APPROVED' | 'NEEDS_LOOK' | 'APPROVED' | 'HELD' | 'EXCUSED';
export type OvertimeStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'AUTO_AUTHORISED';
export type PeriodState = 'OPEN' | 'CLOSING' | 'CLOSED';
export type RequestKind = 'CLOCK_TIME_WRONG' | 'WORKED_NOT_RECORDED' | 'CLOCKED_OUT_BY_MISTAKE' | 'ROTA_WRONG' | 'OVERTIME_MISSING' | 'PAY_OTHER';
export type RequestState = 'WAITING' | 'APPROVED' | 'DECLINED' | 'WITHDRAWN';

export interface Period {
  id: string;
  organizationId: string;
  start: string;
  end: string;
  label: string;
  cutoffAt: string;
  state: PeriodState;
  reportNumber: number;
  closeKind: 'AUTO' | 'EARLY' | null;
  closedAt: string | null;
  closedById: string | null;
  signedById: string | null;
  signedAt: string | null;
  reopenedAt: string | null;
  reopenedById: string | null;
  reopenReason: string | null;
}

export interface PeriodList {
  enabled: boolean;
  periods: Period[];
}

export interface PeriodSummary {
  people: number;
  plannedMinutes: number;
  workedMinutes: number;
  overtimeAuthorisedMinutes: number;
  lateMinutes: number;
  lateDays: number;
  absentDays: number;
  autoApprovedDays: number;
  needsLookDays: number;
  needsLookPeople: number;
  pendingOvertimeItems: number;
}

export interface PersonRow {
  employeeId: string;
  name: string;
  departmentId: string | null;
  departmentName: string | null;
  plannedMinutes: number;
  workedMinutes: number;
  lateMinutes: number;
  lateDays: number;
  absentDays: number;
  overtimeAuthorisedMinutes: number;
  overtimePendingMinutes: number;
  needsLookDays: number;
  status: string;
}

export type PeopleFilter = 'ALL' | 'NEEDS_LOOK' | 'LATE';

export interface PeriodQuery {
  search?: string;
  departmentId?: string;
  filter: PeopleFilter;
  page: number;
  pageSize: number;
}

export interface PeriodView {
  period: Period;
  summary: PeriodSummary;
  weeks: Record<string, number>;
  carriedInDays: number;
  counts: { all: number; needsLook: number; late: number };
  people: { rows: PersonRow[]; page: number; pageSize: number; total: number };
}

export interface Day {
  id: string;
  periodId: string;
  employeeId: string;
  shiftDate: string;
  status: DayStatus;
  reasons: DayReason[];
  scheduledMinutes: number;
  workedMinutes: number;
  minutesLate: number;
  minutesAfterGrace: number;
  leftEarlyMinutes: number;
  afterEndMinutes: number;
  lateExcused: boolean;
  decidedById: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  carriedFromPeriodId: string | null;
}

export interface OvertimeLimits {
  weeklyCapMinutes: number | null;
  weekMinutes: number;
  overCapMinutes: number;
  branchBudgetMinutes: number | null;
  branchUsedMinutes: number;
  insideAllowance: boolean;
}

export interface Overtime {
  id: string;
  periodId: string;
  employeeId: string;
  shiftDate: string;
  rawMinutes: number;
  serviceTailMinutes: number;
  autoMinutes: number;
  needsMinutes: number;
  authorisedMinutes: number;
  status: OvertimeStatus;
  evidence: { openWorkAtEnd: boolean; ordersTaken: number; ticketsCleared: number; openOrdersAtEnd: number };
  limits: OvertimeLimits;
  decidedById: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
}

export interface OvertimeListItem extends Overtime {
  person: { id: string; name: string; departmentName: string | null };
  overdue: boolean;
}

export interface Week {
  weekStart: string;
  status: string;
  scheduledMinutes: number;
  workedMinutes: number;
  partWeek: boolean;
}

export interface Request {
  id: string;
  organizationId: string;
  employeeId: string;
  kind: RequestKind;
  shiftDate: string;
  state: RequestState;
  note: string;
  recorded: Record<string, unknown>;
  requested: Record<string, unknown>;
  waitingOnRole: string;
  waitingOnUserId: string | null;
  escalatedAt: string | null;
  decidedById: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  answerAfter: Record<string, unknown> | null;
  appliedEventId: string | null;
  createdAt: string;
  waitingOnName: string | null;
  waitingDays: number;
  escalatedToHr: boolean;
  decidedByName: string | null;
}

export interface InboxRequest extends Request {
  person: { id: string; name: string; departmentName: string | null };
}

export interface PersonPeriod {
  period: Period;
  person: { id: string; name: string; departmentName: string | null };
  days: Day[];
  weeks: Week[];
  overtime: Overtime[];
  requests: Request[];
}

export interface ReportNote {
  code: 'APPROVED_BY_SYSTEM' | 'OVERTIME_DECIDED' | 'DAY_DECIDED' | 'OPEN_MOVES_ON';
  by: string | null;
  minutes?: number;
  date?: string;
}

export interface ReportRow {
  employeeId: string;
  name: string;
  departmentName: string | null;
  plannedMinutes: number;
  workedMinutes: number;
  lateMinutes: number;
  absentDays: number;
  overtimeAuthorisedMinutes: number;
  notes: ReportNote[];
}

export interface Report {
  number: string;
  organization: string;
  period: Period;
  summary: PeriodSummary;
  rows: ReportRow[];
  closed: { at: string; automatically: boolean; by: string | null } | null;
  signatures: { signedBy: { name: string; role: string; at: string } | null; receivedByPayroll: null };
  carriedOnDays: number;
  carriedOnOvertime: number;
}

export type DayDecision = { outcome: 'ACCEPT'; reason?: string } | { outcome: 'EXCUSE'; reason: string } | { outcome: 'HOLD'; reason: string };
export type OvertimeDecision = { outcome: 'APPROVE'; minutes?: number; reason?: string } | { outcome: 'DECLINE'; reason: string };
export type RequestDecision = { outcome: 'APPROVE'; reason?: string } | { outcome: 'DECLINE'; reason: string };

export type NewRequest =
  | { kind: 'CLOCK_TIME_WRONG'; date: string; type: 'IN' | 'OUT'; at: string; note: string }
  | { kind: 'WORKED_NOT_RECORDED'; date: string; clockIn: string; clockOut: string; note: string }
  | { kind: 'CLOCKED_OUT_BY_MISTAKE'; date: string; at?: string; note: string }
  | { kind: 'ROTA_WRONG'; date: string; note: string }
  | { kind: 'OVERTIME_MISSING'; date: string; minutes?: number; note: string }
  | { kind: 'PAY_OTHER'; date: string; note: string };

export interface MyDay extends Day {
  /** The first shift's clock-in and clock-out as ISO instants; null when not clocked. */
  clockIn: string | null;
  clockOut: string | null;
  overtime: Pick<Overtime, 'status' | 'authorisedMinutes' | 'needsMinutes' | 'rawMinutes'> | null;
  requests: { id: string; kind: RequestKind; state: RequestState }[];
}

export interface MyTime {
  enabled: boolean;
  period: Period | null;
  periods: Period[];
  days: MyDay[];
  weeks: Week[];
  totals: { plannedMinutes: number; workedMinutes: number; lateMinutes: number; overtimeAuthorisedMinutes: number; overtimePendingMinutes: number };
  openRequests: number;
}

export interface MyRota {
  enabled: boolean;
  from: string;
  to: string;
  shifts: { entryId: string; date: string; name: string; colour: string; startTime: string; endTime: string; unpaidBreakMinutes: number }[];
}
