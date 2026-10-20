/**
 * What the Payroll month endpoints answer (API_CONTRACT §40, P1 and P2). Money is a text with two decimals, never a number. Wire names
 * that say `organization` on other endpoints say `siteId` here (the payroll module maps them on the way out).
 */

export type MonthState = 'OPEN' | 'WAITING' | 'IN_REVIEW' | 'TO_APPROVE' | 'TO_PUBLISH' | 'PUBLISHED' | 'PAID';
export type StageKey = 'TIMESHEETS' | 'CALCULATED' | 'REVIEWED' | 'APPROVED' | 'PUBLISHED' | 'PAID';
export type StageStatus = 'DONE' | 'CURRENT' | 'TODO';
export type TabKey = 'timesheets' | 'rules' | 'tax' | 'casual' | 'totals' | 'payslips';

export interface SitesApproved {
  approved: number;
  total: number;
}

export interface MonthListRow {
  monthKey: string;
  label: string;
  state: MonthState;
  stateVersion: number;
  netPay: string | null;
  estimate: { earnedSoFar: string } | null;
  sitesApproved: SitesApproved;
  documentNumber: string | null;
  tabs: TabKey[];
}

export interface MonthList {
  items: MonthListRow[];
  page: number;
  rows: number;
  total: number;
}

export interface StageView {
  key: StageKey;
  number: number;
  name: string;
  status: StageStatus;
  who: string | null;
  /** An ISO time. */
  at: string | null;
  text: string | null;
}

export interface MonthKpis {
  headcount: number;
  gross: string | null;
  net: string | null;
  totalCost: string | null;
  casual: string;
  employerShare: string | null;
  sitesApproved: SitesApproved;
  openLines: number;
  blockingLines: number;
}

export interface MonthCapabilities {
  canReview: boolean;
  canSendToAccountant: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canPay: boolean;
  canCorrect: boolean;
  canExport: boolean;
  canRemind: boolean;
  canApproveSiteLate: boolean;
}

export type SiteTimesheetState = 'OPEN' | 'TO_APPROVE' | 'APPROVED' | 'NOT_ON_NEW_SYSTEM';

/** One site in the month. While the month waits the full row comes; after that only the name, people and the approval. */
export interface MonthSite {
  siteId: string;
  name: string;
  headcount: number;
  timesheetState: SiteTimesheetState;
  approvedAt: string | null;
  documentNumber: string | null;
  waitingSince?: string | null;
  waitingDays?: number;
  lastReminderAt?: string | null;
  canRemindNow?: boolean;
  canApproveLate?: boolean;
}

export interface WaitingBanner {
  kind: 'SITES' | 'TABLES';
  title: string;
  body: string;
  waitingFor: string;
  missing: { group: string; role: string }[];
}

export interface MonthView {
  monthKey: string;
  label: string;
  state: MonthState;
  stateVersion: number;
  stages: StageView[];
  stageCell: { word: string; caption: string };
  /** Null for the running month that has no row yet. */
  kpis: MonthKpis | null;
  capabilities: MonthCapabilities;
  tabs: TabKey[];
  sites: MonthSite[];
  banner: WaitingBanner | null;
  documentNumber: string | null;
  lockedAt?: string | null;
  publishedAt?: string | null;
  paidAt?: string | null;
  /** The sites whose first payroll month this is: the Accountant hand-checks payslips before approving. */
  firstMonthForSites?: string[];
  rulesUsed: { key: string; version: number; effectiveFrom: string | null }[];
  tablesConfirmed: { version: number; by: string | null; at: string | null } | null;
}

export interface ReminderResult {
  monthKey: string;
  siteId: string;
  remindedAt: string;
  repeat: boolean;
}
