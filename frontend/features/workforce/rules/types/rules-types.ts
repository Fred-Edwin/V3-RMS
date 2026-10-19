/**
 * What the Rules API sends and takes (docs/API_CONTRACT.md §39). The wire says `organization` where the back end says site, so
 * every site field here is `organizationId` / `organizationName` / `organizations`. Requests may use either spelling; we send the wire one.
 */
export type RuleGroupCode =
  | 'LATENESS'
  | 'OVERTIME'
  | 'ATTENDANCE'
  | 'LEAVE'
  | 'PROBATION'
  | 'CASUAL_WORK'
  | 'CONDUCT'
  | 'STATUTORY'
  | 'HOLIDAYS'
  | 'WEEK_AND_BREAKS';

export type RuleValues = Record<string, unknown>;

export interface RowAnswer {
  fields: string[];
  kind: 'EDITABLE' | 'FIXED';
  canChange: boolean;
  lockedReason: { whoCan: { role: string; organizationName?: string }[] } | null;
  confirmedBy: { name: string; role: string; at: string } | null;
  waitingForConfirmation: boolean;
  ownRule: boolean;
}

export interface PendingConfirmation {
  scope: string;
  versionId: string;
  version: number;
  effectiveFrom: string;
  inForce: boolean;
  whoCan: { role: string }[];
}

export interface SiteRef {
  organizationId: string;
  organizationName: string;
}

export interface RulesPage {
  group: RuleGroupCode;
  organizationId: string | null;
  organizationName: string | null;
  values: RuleValues;
  companyValues: RuleValues | null;
  version: number;
  siteVersion: number | null;
  effectiveFrom: string | null;
  isDefault: boolean;
  expectedVersion: number;
  expectedSiteVersion: number;
  scheduled: { id: string; version: number; effectiveFrom: string; changedSummary: string } | null;
  pendingConfirmations: PendingConfirmation[];
  ownFields: string[];
  rows: Record<string, RowAnswer>;
  sitesWithOwnRule: (SiteRef & { summary: string })[];
  organizations: SiteRef[];
}

export interface LockedGroup {
  group: RuleGroupCode;
  locked: true;
}

export type RulesPageAnswer = RulesPage | LockedGroup;
export const isLocked = <T extends { group: RuleGroupCode }>(answer: T | LockedGroup): answer is LockedGroup => 'locked' in answer && answer.locked === true;

/** A change as the dialog sends it (preview and save share it). */
export interface ChangeBody {
  organizationId: string | null;
  effectiveFrom: string;
  values: RuleValues;
  useCompanyRuleFor?: string[];
  expectedVersion?: number;
}

export interface PreviewError {
  code: string;
  message: string;
  field: string | null;
  details?: unknown;
}

export interface Preview {
  canSave: boolean;
  errors: PreviewError[];
  changedFields: string[];
  becomes: { version: number; from: string } | null;
  impact: { label: string; value: string }[];
  told: { role: string; count: number }[];
  toldWithoutFigures: boolean;
  needsConfirmation: { scope: string; whoCan: { role: string }[] }[];
  confirmsWithYourPin: string[];
  approvedMonthsAffected: boolean;
  earliestEffectiveFrom: string;
  defaultEffectiveFrom: string;
  expectedVersion: number;
}

export type VersionStatus = 'SCHEDULED' | 'IN_FORCE' | 'REPLACED' | 'WITHDRAWN';

export interface VersionView {
  id: string;
  group: RuleGroupCode;
  organizationId: string | null;
  version: number;
  effectiveFrom: string;
  createdAt: string;
  createdBy: { id: string; name: string; role: string };
  reason: string;
  values: RuleValues;
  changedFields: string[];
  confirmations: { scope: string; by: { id: string; name: string }; at: string; note: string | null }[];
  status: VersionStatus;
  withdrawn: { by: { id: string; name: string; role: string }; at: string; reason: string } | null;
}

export interface SavedVersion {
  version: VersionView;
  notice: { told: { role: string; count: number }[] };
  confirmed: string[];
  waiting: string[];
}

export interface HistoryItem extends VersionView {
  changedSummary: string;
  told: { role: string }[];
}

export interface HistoryPage {
  group: RuleGroupCode;
  organizationId: string | null;
  organizationName: string | null;
  items: HistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  organizations: { organizationId: string | null; organizationName: string }[];
  canWithdraw: { versionId: string; version: number } | null;
}

export type HistoryAnswer = HistoryPage | LockedGroup;

export interface AccessTableRow {
  group: RuleGroupCode;
  slug: string;
  label: string;
  changedBy: { role: string; scope: 'ALL' | 'OWN_SITE'; rows: string[] | null }[];
  confirmedBy: { role: string; what: string | null }[];
  told: { role: string }[];
  text: { changedBy: string; confirmedBy: string; told: string };
}

/** The value shapes the tabs read. They mirror `rules-schemas.ts`; a field the server adds later is ignored. */
export interface LatenessValues {
  graceMinutes: number;
  policy: 'RECORD_ONLY' | 'AFTER_N_LATES' | 'FROM_FIRST_MINUTE';
  afterLatesPerMonth: number | null;
  makeUpSameDay: boolean;
  excuseWindowHours: number;
  deductionCapPercentOfPay: number | null;
}

export interface OvertimeValues {
  serviceTailMinutes: number;
  weeklyCapMinutes: number | null;
  branchBudgetMinutesPerPeriod: number | null;
  approvalWindowHours: number;
  multipliers: { ordinaryDay: string | null; restDay: string | null };
}

export interface AttendanceValues {
  clockInOpensMinutesBefore: number;
  autoCloseAfterMinutes: number;
  locationRadiusMetres: number | null;
  undoWindowSeconds: number;
  clockSkewFlagMinutes: number;
  shiftEndHeadsUpMinutes: number;
  shiftEndPromptRepeatMinutes: number;
}

export interface LeaveType {
  code: string;
  label: string;
  daysPerYear: number | null;
  paid: boolean;
  requiresReason: boolean;
  accrual: 'UP_FRONT' | 'MONTHLY' | 'PER_EVENT';
  perMonthDays: number | null;
  carryOverDays: number;
  sickNoteAfterDays: number | null;
  approvedBy: 'MANAGER' | 'HR';
}

export interface LeaveValues {
  leaveTypes: LeaveType[];
  defaultPolicy: Record<string, number>;
  minimumCover: Record<string, number>;
}

export interface ProbationValues {
  defaultMonths: number;
  maxExtensions: number;
  maxExtensionMonths: number;
  reminderDaysBeforeEnd: number;
  reportDays: number[];
}

export interface CasualValues {
  defaultDailyRate: string | null;
  rates: { departmentId: string; dailyRate: string }[];
  pettyCashHolder: { mode: 'BRANCH_MANAGER' } | { mode: 'NAMED'; userId: string };
}

export interface ConductLevel {
  level: 'VERBAL_NOTE' | 'WRITTEN_WARNING' | 'FINAL_WRITTEN_WARNING';
  label: string;
  validForMonths: number;
  requiresLetter: boolean;
  issuableBy: string[];
}

export interface ConductValues {
  levels: ConductLevel[];
  acknowledgeWithinDays: number;
  appealWithinDays: number;
}

export interface StatutoryBand {
  fromAmount: string;
  toAmount: string | null;
  ratePercent: string | null;
  flatAmount: string | null;
}

export interface StatutoryTable {
  code: 'PAYE' | 'NSSF' | 'SHA' | 'HOUSING_LEVY' | 'RELIEF' | 'OTHER';
  name: string;
  bands: StatutoryBand[];
  note: string | null;
}

export interface StatutoryValues {
  tables: StatutoryTable[];
}

export interface HolidaysValues {
  enabled: boolean;
  payMultiplier: string | null;
  holidays: { date: string; name: string }[];
}

export interface WeekValues {
  weekStartsOn: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}
