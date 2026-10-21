/** Which Home a person gets (Paper frames 1.1 to 1.11). Worked out from the access table, see home-audience.ts. */
export const HOME_AUDIENCES = ['HR', 'DIRECTOR', 'ACCOUNTANT', 'BRANCH_MANAGER', 'STORE_MANAGER', 'HEAD', 'STAFF', 'SYSTEM_ADMIN'] as const;
export type HomeAudience = (typeof HOME_AUDIENCES)[number];

/** One of the five numbers. `problem` is the red-brown one: only for a real problem (overdue, late, security, blocks payroll). */
export interface HomeKpi {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: 'normal' | 'problem';
  /** Where a click goes; null when the number opens nothing. */
  href: string | null;
}

/** Every number any Home needs, counted for the viewer's own reach. A number the viewer cannot see stays 0 and is never shown. */
export interface HomeFacts {
  active: number;
  joinedThisMonth: number;
  inProbation: number;
  /** Probation decisions that fall due in the next 30 days. */
  probationDueSoon: number;
  /** Probation decisions already past their date and not yet taken. Always part of the number above's red state. */
  probationOverdue: number;
  blocksPayroll: number;
  departmentsWithoutHead: number;
  payChangesWaiting: number;
  payChangesThisMonth: number;
  onLeaveToday: number;
  /** Waiting for this person to decide (from Needs you counts). */
  leaveWaiting: number;
  timesheetsWaiting: number;
  conductWaiting: number;
  payrollState: string | null;
  openSecurityAlerts: number;
  passwordResetsThisWeek: number;
  activeUsers: number;
  activeSites: number;
  unconfirmedPhones: number;
  /** The person's own numbers (staff and head Homes). null = no file or no balance. */
  ownLeaveDaysLeft: number | null;
  ownLeaveWaiting: number;
  unreadNotifications: number;
}

export const emptyFacts = (): HomeFacts => ({
  active: 0,
  joinedThisMonth: 0,
  inProbation: 0,
  probationDueSoon: 0,
  probationOverdue: 0,
  blocksPayroll: 0,
  departmentsWithoutHead: 0,
  payChangesWaiting: 0,
  payChangesThisMonth: 0,
  onLeaveToday: 0,
  leaveWaiting: 0,
  timesheetsWaiting: 0,
  conductWaiting: 0,
  payrollState: null,
  openSecurityAlerts: 0,
  passwordResetsThisWeek: 0,
  activeUsers: 0,
  activeSites: 0,
  unconfirmedPhones: 0,
  ownLeaveDaysLeft: null,
  ownLeaveWaiting: 0,
  unreadNotifications: 0,
});

export interface HomeLatestItem {
  id: string;
  title: string;
  body: string;
  tone: string;
  href: string | null;
  createdAt: string;
  read: boolean;
}

/** The Needs you part of Home: the top rows, grouped, with the totals the headline uses. */
export interface HomeNeedsYou {
  total: number;
  overdue: number;
  groups: Array<{ kind: string; label: string; count: number }>;
  rows: Array<{ id: string; kind: string; text: string; opens: string; since: string; siteName: string | null; overdue: boolean }>;
}

export interface HomeView {
  audience: HomeAudience;
  kpis: HomeKpi[];
  /** null when the person holds no Needs you capability (staff, heads, Store Attendant): that Home draws action cards instead. */
  needsYou: HomeNeedsYou | null;
  latest: HomeLatestItem[];
  unread: number;
}
