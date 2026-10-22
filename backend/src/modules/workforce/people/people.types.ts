import type { SensitiveGroup } from '../_shared/workforce-access';
import type { ChecklistRow, FilePart } from './people-completeness';
import type { ImpactLine } from './people-hooks';
import type { ExitReason, FileRequestKind, PayChangeReason, ProbationVerdict } from './people.constants';

/** A Nairobi calendar date, YYYY-MM-DD. */
export type DateString = string;
/** Money as a string with up to two decimals. Never a float. */
export type MoneyString = string;

export type EmploymentStatusCode = 'ONBOARDING' | 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'NOTICE' | 'EXITED';
export type ContractStatusCode = 'NONE' | 'ACTIVE' | 'ENDED';
export type Employment = 'MONTHLY' | 'CASUAL';

export interface Pagination {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
export interface ListResponse<T> {
  success: true;
  data: T[];
  pagination: Pagination;
}

export interface EmployeeListRow {
  id: string;
  employeeNumber: string;
  name: string;
  photoUrl: string | null;
  positionName: string | null;
  siteId: string;
  siteName: string;
  departmentId: string | null;
  departmentName: string | null;
  employment: Employment;
  contractStatus: ContractStatusCode;
  status: EmploymentStatusCode;
  probationEndsOn: DateString | null;
  /** Only parts the viewer may see: a Branch Manager never sees bank or pay gaps. */
  gaps: FilePart[];
  reportsToName: string | null;
  isHead: boolean;
}

export interface PeopleSummary {
  onFile: number;
  active: number;
  exited: number;
  needsFinishing: number;
  /** Files with a gap that stops pay or the rota (job, pay, payout, NSSF and SHA), counted for what this viewer can see. */
  blocksPayroll: number;
  noContract: number;
  joinedThisMonth: number;
  stillInProbation: number;
  casualPool: number;
}

export interface ProbationNoteView {
  authorName: string;
  /** "Head of Kitchen": the author's position when they have a file (HR's Decide dialog shows it). */
  authorPosition: string | null;
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

export interface TimelineEvent {
  on: DateString;
  kind: 'HIRED' | 'DOCUMENT' | 'PAY_CHANGE' | 'TRANSFER' | 'LOAN' | 'PROBATION' | 'CONTRACT' | 'EXIT' | 'REHIRE';
  detail: Record<string, string | number | null>;
}
export interface NextStep {
  code: 'PROBATION_DECISION' | 'CREATE_CONTRACT' | 'FILE_REQUEST' | 'FINISH_FILE';
  dueOn: DateString | null;
  fileRequestId?: string;
  /** For FILE_REQUEST: what was asked and when, so a screen can put "Remind" on the right row. */
  fileRequestKind?: FileRequestKind;
  fileRequestAskedOn?: DateString;
}

/** What the caller may do with this file; the screen shows or hides buttons from it. */
export interface EmployeeActions {
  editJob: boolean;
  changePay: boolean;
  /** The IDs card's Edit (National ID, KRA PIN, NSSF, SHA, HELB): HR and above. */
  editIds: boolean;
  /** The bank and account: HR and above, and the Accountant. */
  editBank: boolean;
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

export interface EmployeeFileView {
  id: string;
  employeeNumber: string;
  name: string;
  photoUrl: string | null;
  status: EmploymentStatusCode;
  employment: Employment;
  contractStatus: ContractStatusCode;
  tracksTime: boolean;
  tracksTimeFromPosition: boolean;
  site: { id: string; name: string };
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
  reportsTo: { id: string; name: string; isHead: boolean; positionName: string | null; siteName: string } | null;
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
  /** Null unless the viewer may see pay, bank and IDs (the person themself, HR, Director, Accountant). */
  completeness: {
    ringPercent: number;
    checklistPercent: number;
    parts: { part: FilePart; applicable: boolean; done: boolean }[];
    checklist: { row: ChecklistRow; applicable: boolean; done: boolean }[];
  } | null;
  probation: ProbationView | null;
  exit: ExitView | null;
  nextSteps: NextStep[];
  timeline: TimelineEvent[];
  actions: EmployeeActions;
  loan: { hostSiteName: string; from: DateString; until: DateString | null } | null;
  scheduledMove: { kind: 'TRANSFER' | 'LOAN'; startsOn: DateString; toSiteName: string } | null;
}

export interface PayChangeRow {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: MoneyString;
  effectiveFrom: DateString;
  /** True while the start date is still ahead (the screens say "Starts 22 Oct", not "changed"). */
  startsInFuture: boolean;
  reason: PayChangeReason;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED';
  requestedByName: string | null;
  /** "HR Manager · Head Office": the asker's position and site when they have a file; null otherwise. */
  requestedByPosition: string | null;
  requestedBySite: string | null;
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
  /** Monthly: amount / (week hours x 52 / 12); daily: amount / day hours. Decimal arithmetic, half-up to 2 places. Null until the hours are set. */
  hourlyEquivalent: MoneyString | null;
  payoutMethod: 'BANK' | 'MPESA' | 'CASH' | null;
  bank: { name: string | null; branch: string | null; accountName: string | null; accountNumberMasked: string | null; mpesaPhoneMasked: string | null } | null;
  history: PayChangeRow[];
  pending: PayChangeRow | null;
  locked: SensitiveGroup[];
}

export interface ContractRow {
  id: string;
  contractTypeName: string | null;
  startsOn: DateString;
  endsOn: DateString | null;
  status: ContractStatusCode;
  /** Empty until Signed documents (slice 4). */
  signedDocumentId: string | null;
}
export interface DocumentRow {
  id: string;
  documentType: string;
  fileName: string;
  uploadedByName: string | null;
  uploadedOn: DateString;
}
export interface FileRequestRow {
  id: string;
  kind: FileRequestKind;
  askedOn: DateString;
  remindedOn: DateString | null;
  resolvedOn: DateString | null;
}
export interface UnlinkedAccount {
  userId: string;
  name: string;
  email: string;
  role: string;
  siteName: string | null;
  createdOn: DateString;
}

export interface HireResult {
  employee: EmployeeFileView;
  login: { created: boolean; reason?: string };
  nextStep: 'CREATE_CONTRACT' | 'FINISH_FILE' | 'ADD_TO_ROTA';
}

export interface MoveRow {
  id: string;
  kind: 'TRANSFER' | 'LOAN';
  status: 'SCHEDULED' | 'ACTIVE' | 'DONE' | 'CANCELLED';
  employeeId: string;
  fromSite: { id: string; name: string };
  toSite: { id: string; name: string };
  toDepartment: { id: string; name: string } | null;
  startsOn: DateString;
  endsOn: DateString | null;
}
/** Used by transfer and exit previews. Nothing is written. `impacts` come from later slices; absent lines mean "not built yet". */
export interface MovePreview {
  effectiveOn: DateString;
  newHead: { employeeId: string; name: string } | null;
  newReportsTo: { employeeId: string; name: string } | null;
  notified: { userId: string; name: string }[];
  impacts: ImpactLine[];
}

export interface Lookups {
  sites: { id: string; name: string; type: 'BRANCH' | 'CENTRAL_STORE'; isHub: boolean }[];
  departments: { id: string; siteId: string; name: string; inventoryTag: string | null; isActive: boolean }[];
  positions: { id: string; name: string; defaultTracksTime: boolean; loginRole: string | null; casualsAllowed: boolean; departmentIds: string[]; isActive: boolean }[];
  assignableLoginRoles: string[];
  exitReasons: ExitReason[];
  payChangeReasons: PayChangeReason[];
  probationVerdicts: ProbationVerdict[];
  contractTypes: { id: string; name: string; durationMonths: number | null }[];
  probationRule: { defaultMonths: number; maxExtensions: number; maxExtensionMonths: number };
  exitUndoDays: number;
}
