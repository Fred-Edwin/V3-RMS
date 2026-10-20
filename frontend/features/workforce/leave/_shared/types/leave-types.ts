/**
 * Leave wire shapes (API_CONTRACT §45). Dates are Nairobi dates as `YYYY-MM-DD`; moments are ISO strings. Mirrors the back end's
 * `leave.types.ts`, the read services and the validators; nothing here is computed on the screen.
 */
export type LeaveStatus = 'WAITING' | 'APPROVED' | 'DECLINED' | 'CANCELLED';
export type LeaveStage = 'MANAGER' | 'HR' | 'DIRECTOR';
export type LeavePhase = 'WAITING' | 'BOOKED' | 'ON_LEAVE' | 'TAKEN' | 'DECLINED' | 'CANCELLED';
export type BarTone = 'GREEN' | 'AMBER' | 'RED' | 'NONE';
export type DeclineReason = 'TOO_FEW' | 'BUSY' | 'NOTICE' | 'OTHER';
export type CancelReason = 'STAFFING' | 'PERSON_ASKED' | 'MISTAKE' | 'OTHER';
export type AdjustReason = 'DIRECTOR_GRANT' | 'CORRECTION' | 'RETURNED_EARLY' | 'BIRTH_OR_ADOPTION' | 'OTHER';

export interface ApplicationSummary {
  id: string;
  employeeId: string;
  typeCode: string;
  typeLabel: string;
  paid: boolean;
  start: string;
  end: string;
  days: number;
  unpaidTailDays: number;
  status: LeaveStatus;
  phase: LeavePhase;
  stage: LeaveStage;
  decidingRole: string | null;
  askedAt: string;
  movesToHrAt: string | null;
  decidedAt: string | null;
  slipNumber: number | null;
  version: number;
}

export interface TypeBalance {
  typeCode: string;
  label: string;
  paid: boolean;
  perYear: number | null;
  credited: number;
  taken: number;
  booked: number;
  left: number;
  tone: BarTone;
  builds: { perMonth: number } | null;
  spoken: string;
}

export interface RequestableType {
  code: string;
  label: string;
  paid: boolean;
  left: number | null;
  requiresReason: boolean;
  approvedBy: 'MANAGER' | 'HR';
  sickNoteAfterDays: number | null;
  tailAllowed: boolean;
}

export interface MyOverview {
  year: number;
  casual: boolean;
  onPolicy: boolean;
  message: string | null;
  headline: { typeCode: string; left: number } | null;
  waiting: { count: number; oldest: ApplicationSummary | null } | null;
  cards: TypeBalance[];
  chips: RequestableType[];
}

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type MyRow = ApplicationSummary & { slipCode: string | null };

export type StepState = 'DONE' | 'CURRENT' | 'DECLINED' | 'PASSED' | 'TODO';
export interface LeaveStep {
  kind: 'ASKED' | 'MOVED_TO_HR' | 'DECIDER' | 'ENDING';
  state: StepState;
  at: string | null;
  byRole: string | null;
  line: string;
}

export interface ApplicationDetail {
  application: ApplicationSummary & { slipCode: string | null };
  person: { id: string; name: string; roleLabel: string; department: string | null; site: string; head: string | null };
  note: string | null;
  decision: { reasonCode: string | null; note: string | null; byRole: string | null; at: string | null } | null;
  steps: LeaveStep[];
  figures: { asked: number; leftNow: number | null; ifApproved: number | null } | { before: number | null; taken: number; after: number | null };
  can: { cancel: boolean; askAgain: boolean; slip: boolean; approve: boolean; decline: boolean; cancelApproved: boolean };
  whyNot: string | null;
}

export interface AskError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PreviewBody {
  typeCode: string;
  start: string;
  end: string;
  unpaidTailDays?: number;
}

export interface Preview {
  typeCode: string;
  days: number;
  returnOn: string;
  left: number | null;
  leftAfter: number | null;
  shortfall: number;
  suggestedTail: number;
  tailAllowed: boolean;
  tight: boolean;
  sickNote: boolean;
  sendTo: string;
  errors: AskError[];
}

export interface AskBody extends PreviewBody {
  note?: string;
}

export interface WriteResult {
  application: ApplicationSummary;
  repeat: boolean;
}

export interface ApproveResult extends WriteResult {
  slipNumber: number;
  slipCode: string;
  rotaCellsRemoved: number;
}

export interface RequestRow {
  application: ApplicationSummary;
  person: { id: string; name: string; roleLabel: string; department: string | null; site: string };
  rota: 'CLASH' | 'OK' | 'NOT_PLANNED' | null;
  routedToMe: boolean;
  can: { approve: boolean; decline: boolean; cancel: boolean };
  whyNot: string | null;
}

export interface RequestsKpis {
  needsYou: number;
  awayToday: { count: number; names: string[] };
  awayNext14: { people: number; names: string[] };
  daysThisMonth: { days: number; people: number };
}

export type RequestsPage = Page<RequestRow> & { kpis: RequestsKpis };

export interface RotaPanel {
  department: string | null;
  head: { name: string; role: string } | null;
  days: {
    date: string;
    planned: boolean;
    minimum: number | null;
    working: number;
    tight: boolean;
    rows: { employeeId: string; name: string; cell: 'SHIFT' | 'LEAVE' | 'ASKED' | 'OFF'; templateName: string | null }[];
  }[];
  balanceBefore: number | null;
  balanceAfter: number | null;
}

export interface BalanceRow {
  employeeId: string;
  name: string;
  roleLabel: string;
  department: string | null;
  siteName: string;
  annualLeft: number | null;
  annualBooked: number | null;
  sickUsed: number | null;
  note: { kind: 'NONE' | 'LOW' | 'ADJUSTED' | 'BOOKED' | 'NOT_ON_POLICY'; text: string };
  adjustedThisMonth: boolean;
}

export interface BalancesPage extends Page<BalanceRow> {
  kpis: { people: number; lowBalance: number; adjustedThisMonth: number; bookedDays: number };
  sites: { id: string; name: string; people: number }[];
}

export interface BalanceDrawer {
  person: { id: string; name: string; roleLabel: string; department: string | null; site: string; onPolicy: boolean; note: string | null };
  year: number;
  cards: TypeBalance[];
  requests: ApplicationSummary[];
  adjustments: { at: string; typeCode: string; days: number; reasonCode: string | null; by: string | null }[];
}

export interface AdjustPreview {
  employeeId: string;
  typeCode: string;
  typeLabel: string;
  now: number;
  new: number;
  told: { name: string; label: string }[];
  errors: { code: string; message: string }[];
}

export interface AdjustBody {
  employeeId: string;
  typeCode: string;
  add: number;
  reasonCode: AdjustReason;
  note?: string;
  pin: string;
  expectedNow?: number;
}

export interface AdjustResult {
  employeeId: string;
  typeCode: string;
  before: number;
  after: number;
  repeat: boolean;
  adjustedThisMonth: boolean;
}

export interface CalendarBar {
  id: string;
  start: string;
  end: string;
  days: number;
  status: 'APPROVED' | 'WAITING';
  typeLabel: string;
}

export interface CalendarView {
  from: string;
  to: string;
  people: { id: string; name: string; roleLabel: string; department: string | null; bars: CalendarBar[] }[];
  coverRows: { date: string; working: number; minimum: number | null; planned: boolean }[];
  clashes: { date: string; applicationId: string }[];
}

export interface AwayPerson {
  employeeId: string;
  name: string;
  roleLabel: string;
  department: string | null;
  siteId: string;
  applicationId: string;
  start: string;
  end: string;
  days: number;
}

export interface RequestsQuery {
  tab: 'recent' | 'needs-you';
  site?: string;
  dept?: string;
  q?: string;
  page: number;
  rows: number;
}

export interface BalancesQuery {
  site?: string;
  dept?: string;
  filter: 'all' | 'low' | 'adjusted' | 'booked';
  q?: string;
  leavers?: boolean;
  page: number;
  rows: number;
}

export interface MineQuery {
  year: number;
  status?: LeaveStatus[];
  page: number;
  rows: number;
}

export interface FileBlob {
  blob: Blob;
  filename: string;
}
