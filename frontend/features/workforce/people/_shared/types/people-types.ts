/**
 * What the People API sends, as the screens read it. Mirrors `backend/src/modules/workforce/people/people.types.ts`; the server is the
 * authority. RESPONSES use the wire names (`organization`, `organizationId`, `organizationName`, `organizations`) where the code says
 * `site`; these types say what is really on the wire. REQUESTS may use either spelling, so request bodies keep `siteId`.
 */

/** A Nairobi calendar date, YYYY-MM-DD. */
export type DateString = string;
/** Money as a string with up to two decimals. Never a float. */
export type MoneyString = string;

export type EmploymentStatusCode = 'ONBOARDING' | 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'NOTICE' | 'EXITED';
export type ContractStatusCode = 'NONE' | 'ACTIVE' | 'ENDED';
export type Employment = 'MONTHLY' | 'CASUAL';
export type SensitiveGroup = 'pay' | 'bank' | 'ids' | 'documents' | 'discipline' | 'payslip_opens';

export const FILE_PARTS = ['IDENTITY', 'JOB', 'PAY', 'BANK', 'LOGIN', 'NSSF_SHA', 'PHOTO_AND_DETAILS', 'EMERGENCY_CONTACT', 'CONTRACT'] as const;
export type FilePart = (typeof FILE_PARTS)[number];
export type ChecklistRowKey = 'WHO_AND_JOB' | 'PAY_AND_BANK' | 'LOGIN' | 'NSSF_SHA' | 'PHOTO_AND_DETAILS' | 'CONTRACT';

export const EXIT_REASONS = ['RESIGNED', 'END_OF_CONTRACT', 'DISMISSED', 'REDUNDANCY', 'RETIRED', 'OTHER'] as const;
export type ExitReason = (typeof EXIT_REASONS)[number];
export const PAY_CHANGE_REASONS = ['HIRING', 'PROBATION_CONFIRMED', 'PROMOTION', 'ANNUAL_REVIEW', 'CORRECTION', 'OTHER'] as const;
export type PayChangeReason = (typeof PAY_CHANGE_REASONS)[number];
export type FileRequestKind = 'EMERGENCY_CONTACT' | 'NSSF_SHA' | 'PHOTO_AND_DETAILS' | 'ID_NUMBER' | 'BANK_DETAILS';
export type ProbationVerdict = 'GOOD' | 'CONCERNS';
export type PayoutMethod = 'BANK' | 'MPESA' | 'CASH';
export type HireLoginRole = 'WAITER' | 'CHEF' | 'BARISTA' | 'STEWARD' | 'HOUSEKEEPING' | 'STORE_ATTENDANT';

export interface Pagination {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface EmployeeListRow {
  id: string;
  employeeNumber: string;
  name: string;
  photoUrl: string | null;
  positionName: string | null;
  organizationId: string;
  organizationName: string;
  departmentId: string | null;
  departmentName: string | null;
  employment: Employment;
  contractStatus: ContractStatusCode;
  status: EmploymentStatusCode;
  probationEndsOn: DateString | null;
  gaps: FilePart[];
  reportsToName: string | null;
  isHead: boolean;
}

export interface PeopleSummary {
  onFile: number;
  active: number;
  exited: number;
  needsFinishing: number;
  noContract: number;
  joinedThisMonth: number;
  stillInProbation: number;
  casualPool: number;
}

export interface ProbationNoteView {
  authorName: string;
  authorKind: 'HEAD' | 'BRANCH_MANAGER' | 'HR';
  verdict: ProbationVerdict;
  note: string | null;
  createdOn: DateString;
}
export interface ProbationView {
  endsOn: DateString;
  dayNumber: number;
  totalDays: number;
  daysLeft: number;
  extensions: number;
  extensionsAllowed: number;
  decidedOn: DateString | null;
  confirmedOn: DateString | null;
  confirmationWaitingForContract: boolean;
  notes: ProbationNoteView[];
}

export interface ExitView {
  lastDay: DateString;
  reason: ExitReason;
  note: string | null;
  uniformReturned: boolean;
  exitedByName: string | null;
  recordedOn: DateString | null;
  finalized: boolean;
  undoUntil: DateString;
  canUndo: boolean;
  canRehire: boolean;
}

export type TimelineKind = 'HIRED' | 'DOCUMENT' | 'PAY_CHANGE' | 'TRANSFER' | 'LOAN' | 'PROBATION' | 'CONTRACT' | 'EXIT' | 'REHIRE';
export interface TimelineEvent {
  on: DateString;
  kind: TimelineKind;
  detail: Record<string, string | number | null>;
}
export interface NextStep {
  code: 'PROBATION_DECISION' | 'CREATE_CONTRACT' | 'FILE_REQUEST' | 'FINISH_FILE';
  dueOn: DateString | null;
  fileRequestId?: string;
}

/** What the caller may do with this file; the screen shows or hides buttons from it, never from a role name. */
export interface EmployeeActions {
  editJob: boolean;
  changePay: boolean;
  transfer: boolean;
  sendToSite: boolean;
  exit: boolean;
  undoExit: boolean;
  rehire: boolean;
  decideProbation: boolean;
  writeNote: boolean;
  createContract: boolean;
  uploadDocument: boolean;
  remind: boolean;
  createLogin: boolean;
}

export interface FileCompleteness {
  ringPercent: number;
  checklistPercent: number;
  parts: { part: FilePart; applicable: boolean; done: boolean }[];
  checklist: { row: ChecklistRowKey; applicable: boolean; done: boolean }[];
}

export interface EmployeeFile {
  id: string;
  employeeNumber: string;
  name: string;
  photoUrl: string | null;
  status: EmploymentStatusCode;
  employment: Employment;
  contractStatus: ContractStatusCode;
  tracksTime: boolean;
  tracksTimeFromPosition: boolean;
  organization: { id: string; name: string };
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
  reportsTo: { id: string; name: string; isHead: boolean } | null;
  startDate: DateString;
  hasLogin: boolean;
  loginRole: string | null;
  isHead: boolean;
  personalPhone: string | null;
  personalEmail: string | null;
  emergencyContact: { name: string; relation: string | null; phone: string } | null;
  /** Present only for groups the viewer may see. ID and bank values are masked ("•••• 5678") unless it is the person's own file. */
  sensitive: Partial<Record<string, string | null>>;
  locked: SensitiveGroup[];
  completeness: FileCompleteness | null;
  probation: ProbationView | null;
  exit: ExitView | null;
  nextSteps: NextStep[];
  timeline: TimelineEvent[];
  actions: EmployeeActions;
  loan: { hostSiteName: string; from: DateString; until: DateString | null } | null;
  scheduledMove: { kind: 'TRANSFER' | 'LOAN'; startsOn: DateString; toOrganizationName: string } | null;
}

export interface PayChangeRow {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: MoneyString;
  effectiveFrom: DateString;
  reason: PayChangeReason;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED';
  requestedByName: string | null;
  requestedOn: DateString;
  decidedByName: string | null;
  decidedOn: DateString | null;
  decisionNote: string | null;
}
export interface PayView {
  payType: 'MONTHLY_SALARY' | 'DAILY_RATE';
  amount: MoneyString | null;
  overtimeEligible: boolean;
  standardWeekHours: string | null;
  standardDayHours: string | null;
  hourlyEquivalent: MoneyString | null;
  payoutMethod: PayoutMethod | null;
  bank: { name: string | null; branch: string | null; accountName: string | null; accountNumberMasked: string | null; mpesaPhoneMasked: string | null } | null;
  history: PayChangeRow[];
  pending: PayChangeRow | null;
  locked: SensitiveGroup[];
}

export interface DocumentRow {
  id: string;
  documentType: string;
  fileName: string;
  uploadedByName: string | null;
  uploadedOn: DateString;
}

export interface HireResult {
  employee: EmployeeFile;
  login: { created: boolean; reason?: string };
  nextStep: 'CREATE_CONTRACT' | 'FINISH_FILE' | 'ADD_TO_ROTA';
}

export interface ImpactLine {
  code: string;
  count: number | null;
  detail: Record<string, string | number | null>;
}
export interface MovePreview {
  effectiveOn: DateString;
  newHead: { employeeId: string; name: string } | null;
  newReportsTo: { employeeId: string; name: string } | null;
  notified: { userId: string; name: string }[];
  impacts: ImpactLine[];
}

export interface DuplicateCheck {
  nationalId?: boolean;
  phone?: boolean;
  email?: boolean;
}

export interface Lookups {
  organizations: { id: string; name: string; type: 'BRANCH' | 'CENTRAL_STORE'; isHub: boolean }[];
  departments: { id: string; organizationId: string; name: string; inventoryTag: string | null; isActive: boolean }[];
  positions: { id: string; name: string; defaultTracksTime: boolean; loginRole: string | null; casualsAllowed: boolean; departmentIds: string[]; isActive: boolean }[];
  assignableLoginRoles: string[];
  exitReasons: ExitReason[];
  payChangeReasons: PayChangeReason[];
  probationVerdicts: ProbationVerdict[];
  contractTypes: { id: string; name: string; durationMonths: number | null }[];
  probationRule: { defaultMonths: number; maxExtensions: number; maxExtensionMonths: number };
  exitUndoDays: number;
}

export interface EmployeeListQuery {
  siteId?: string;
  departmentId?: string;
  filter?: 'all' | 'needs_finishing' | 'no_contract' | 'casual_pool' | 'on_probation' | 'exited';
  q?: string;
  page?: number;
  perPage?: number;
}
