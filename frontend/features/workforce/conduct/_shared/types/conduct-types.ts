/**
 * The shapes of API_CONTRACT §44 (Conduct), written from the back end's services. Dates arrive as ISO strings; the words with a day name
 * ("Fri 9 Oct, 16:42") are made on the phone from them in Nairobi time (`lib/conduct-words.ts`), except where the server already sends the line.
 */
export type ConductLevel = 'VERBAL_NOTE' | 'WRITTEN_WARNING' | 'FINAL_WRITTEN_WARNING';
export type ConductAbout = 'LATENESS' | 'ABSENCE' | 'BEHAVIOUR' | 'SAFETY_HYGIENE' | 'OTHER';
export type ConductStatus = 'ISSUED' | 'RECORDED' | 'SIGNED' | 'GIVEN_NOT_SIGNED' | 'APPEALED' | 'KEPT' | 'REPLACED' | 'WITHDRAWN' | 'ENDED';
export type AppealReasonKey = 'FACTS_WRONG' | 'GOOD_REASON' | 'TOO_STRONG' | 'OTHER';
export type DecisionOutcome = 'KEEP' | 'REDUCE_TO_WRITTEN' | 'REDUCE_TO_VERBAL' | 'WITHDRAW';
export type NotSignedReason = 'REFUSED' | 'NOT_REACHED' | 'NO_LOGIN';
export type StepState = 'done' | 'current' | 'todo' | 'amber';
export type StepKey = 'issued' | 'sign' | 'appeal' | 'decided' | 'ends' | 'recorded' | 'replaced';

export interface NoticeStep {
  key: StepKey;
  state: StepState;
  title: string;
  line: string;
}

/** S1, S7: the staff member's list. */
export interface StaffItem {
  id: string;
  level: ConductLevel;
  number: string | null;
  title: string;
  aboutLabel: string;
  issuedAt: string;
  validUntil: string;
  validUntilLabel: string;
  status: ConductStatus;
  statusWord: string;
  headline: string;
  canSign: boolean;
  canAppeal: boolean;
  hasLetter: boolean;
  replacedById: string | null;
}

export interface LegacyRow {
  id: string;
  level: string;
  actionDate: string;
  label: string;
}

export interface StaffList {
  counts: { toSign: number; canAppeal: number; ended: number; appealed: number; replaced: number; withdrawn: number };
  columns: { key: string; label: string; value: number }[];
  headline: string;
  items: StaffItem[];
  legacy: LegacyRow[];
}

/** S2, S4: one notice for the person it is about. */
export interface StaffDetail {
  view: 'STAFF';
  id: string;
  title: string;
  level: ConductLevel;
  number: string | null;
  aboutLabel: string;
  issuerRole: string;
  issuedAt: string;
  status: ConductStatus;
  statusWord: string;
  factsLine: string | null;
  verbalLine: string | null;
  ackDays: number;
  appealDays: number;
  validUntil: string;
  steps: NoticeStep[];
  actions: { canSign: boolean; canAppeal: boolean; canDownload: boolean; downloadVersion: number };
  appeal: { appealedAt: string; reasonLabel: string; text: string } | null;
  decision: { outcome: DecisionOutcome; reason: string; decidedAt: string; decidedByLabel: 'HR' | 'Director' } | null;
  replacedById: string | null;
  replacesNoticeId: string | null;
}

export interface FactsRow {
  date: string;
  plannedIn: string | null;
  clockIn: string | null;
  minutesLate: number;
  excused: boolean;
  named: boolean;
}

export type WitnessState = 'WAITING' | 'CONFIRMED' | 'DECLINED' | 'NOT_CONFIRMED';

/** S8, S12: one notice for a manager, HR or the Director. */
export interface DeskDetail {
  view: 'DESK';
  id: string;
  personId: string;
  personName: string;
  jobLabel: string;
  siteName: string;
  title: string;
  level: ConductLevel;
  number: string | null;
  aboutLabel: string;
  issuedAt: string;
  issuerLabel: string;
  status: ConductStatus;
  statusWord: string;
  ownLine: string;
  verbalLine: string | null;
  facts: { kind: string; monthKey: string; count: number; minutes: number; rows: FactsRow[] } | null;
  checkedForYou: string[];
  signedLine: string;
  appealLine: string;
  witness: { askedAt: string; state: WitnessState } | null;
  appeal: { appealedAt: string; reasonKey: AppealReasonKey; reasonLabel: string; text: string; dueBy: string; overdueDays: number } | null;
  decisions: { version: number; outcome: DecisionOutcome; reason: string; decidedAt: string; decidedBy: string }[];
  validUntil: string;
  months: number;
  version: number;
  actions: { canRecordNotSigned: boolean; recordableFrom: string | null; canDecide: boolean; outcomes: DecisionOutcome[]; canChange: boolean; canOpenAsIssued: boolean };
  updatedAt: string;
}

export type NoticeDetail = StaffDetail | DeskDetail;

export interface DeskRow {
  id: string;
  personId: string;
  personName: string;
  jobLabel: string;
  level: ConductLevel;
  levelLabel: string;
  number: string | null;
  aboutLabel: string;
  issuedAt: string;
  status: ConductStatus;
  statusWord: string;
  siteId: string;
  siteName: string;
  issuedAtSite: string | null;
}

export type DeskFilter = 'active' | 'appealed' | 'ended';

export interface DeskList {
  counts: { active: number; written: number; endingIn30: number; appealsWithHr: number; appealed: number; ended: number };
  nextEnding: { jobLabel: string; date: string } | null;
  items: DeskRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DeskQuery {
  status: DeskFilter;
  q: string;
  site: string;
  page: number;
  pageSize: number;
}

/** S9 */
export interface IssuePerson {
  id: string;
  name: string;
  department: string | null;
  employeeNumber: string;
  isMyTeam: boolean;
  hasLogin: boolean;
  activeNotices: { level: ConductLevel; validUntil: string }[];
}

export interface Draft {
  suggestedLevel: ConductLevel | null;
  finalAllowed: boolean;
  finalAlreadyActive: boolean;
  justIssued: boolean;
  hasLogin: boolean;
  facts: { kind: string; monthKey: string; count: number; minutes: number; days: { date: string; plannedIn: string | null; clockIn: string | null; minutesLate: number }[] } | null;
  months: string[];
  month: string;
  noFacts: boolean;
  validUntilByLevel: Record<ConductLevel, string>;
  ackDays: number;
  appealDays: number;
  levels: { level: ConductLevel; label: string; hasLetter: boolean }[];
}

export interface IssueBody {
  personId: string;
  level: ConductLevel;
  about: ConductAbout;
  factsMonth?: string;
  ownLine: string;
  pin: string;
  idempotencyKey: string;
}

export interface Issued {
  id: string;
  number: string | null;
  status: ConductStatus;
}

export interface WitnessOption {
  userId: string;
  name: string;
  roleLabel: string;
}

export interface WitnessCard {
  noticeId: string;
  issuerRole: string;
  personRole: string;
  reason: NotSignedReason;
  date: string;
  answered: 'CONFIRMED' | 'DECLINED' | null;
}

export interface DecisionPreview {
  outcome: DecisionOutcome;
  from: ConductLevel;
  to: ConductLevel | null;
  daysTaken: number | null;
  endsOn: string | null;
  oldNotice: 'KEPT' | 'REPLACED' | 'WITHDRAWN';
}

export interface FileTab {
  notices: { id: string; title: string; aboutLabel: string; status: ConductStatus; statusWord: string; issuedAt: string; validUntil: string; issuerLabel: string; hasLetter: boolean; live: boolean }[];
  timeline: { at: string; text: string }[];
  legacy: LegacyRow[];
  access: { role: string; text: string }[];
  canIssue: boolean;
}

export interface FileBlob {
  blob: Blob;
  filename: string;
}
