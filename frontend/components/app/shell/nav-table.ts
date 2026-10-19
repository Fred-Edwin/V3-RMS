import {
  AlertTriangle,
  Banknote,
  BarChart2,
  Bike,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarOff,
  ChefHat,
  ClipboardList,
  Clock,
  Coffee,
  CreditCard,
  FileText,
  GitBranch,
  House,
  Inbox,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  Network,
  Percent,
  Plane,
  ScrollText,
  Settings2,
  ShieldAlert,
  ShoppingCart,
  SlidersVertical,
  SquareCheckBig,
  Tags,
  Truck,
  UserCircle,
  UserRound,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

import type { Capability } from '@/features/inventory';
import type { AppRole } from '@/types/auth';
import {
  AuditLogIcon,
  CatalogIcon,
  DispatchIcon,
  PrepIcon,
  PurchasingIcon,
  ReceivingIcon,
  SettingsIcon,
  StockCountsIcon,
  SuppliersIcon,
  fromLucide,
  type NavIcon,
} from './nav-icons';

/**
 * THE NAVIGATION TABLE. One list of rows, one sidebar for every desktop role (the sibling of the Central Store access table,
 * `backend/src/modules/inventory/_shared/central-store-access.ts`). Each row is a link: what it is called, which group it sits in,
 * its icon, where it goes, and who may see it. This file is shell configuration: it holds links, labels and roles, never feature code.
 *
 * Rebuilding a feature means changing that feature's rows from `oldHref` to `newHref` (and nothing else; the shell, the layout and
 * the other rows stay as they are). A row with a `newHref` is a rebuilt screen that draws its own top bar; a row with an `oldHref`
 * is an old page, and the shell puts a thin top bar above it. `framed` overrides that for the old-flow Central Store screens, which
 * already draw their own bar.
 *
 * The route gate (`lib/route-access.ts`, called by `middleware.ts`) stays the only authority on access. The table must never show
 * a role a link that gate would bounce; `nav-table.test.ts` fails if it does. Group order is the order the groups first appear in
 * this list, per role, so each role's rows are written together, in the order that role sees them.
 */

export type NavFlag = 'credit';
export type NavBadge =
  | 'inbox'
  | 'prep-needs-look'
  | 'requisitions'
  | 'discrepancies'
  | 'deliveries'
  | 'branch-day-todo'
  | 'purchasing-receiving'
  | 'purchasing-restock'
  | 'purchasing-my-orders'
  // Workforce slots (Paper Chapter 1, step 01). The shell draws a count only when a slice feeds it; today none does, so they draw nothing.
  | 'workforce-waiting'
  | 'workforce-timesheets'
  | 'workforce-leave';

/** A badge that only some people may see: it is dropped (not just hidden) for anyone without the capability. */
export const BADGE_CAPABILITY: Partial<Record<NavBadge, Capability>> = { 'prep-needs-look': 'prep.read_flags', requisitions: 'requisitions.read', discrepancies: 'requisitions.read', 'branch-day-todo': 'branch_day.close' };

interface Visibility {
  /** Roles that see the row. Never wider than what the route gate lets in. */
  roles: readonly AppRole[];
  /** Central Store capability from the server's table (`GET /inventory/permissions/me`); the row shows only when it is held. */
  capability?: Capability;
  /** Shows when at least one of these is held. */
  anyCapability?: readonly Capability[];
  /** Hidden unless `NEXT_PUBLIC_CREDIT_ACCOUNTS_ENABLED` is on. */
  flag?: NavFlag;
  /** Shows only for a department head (the marker on the token), whatever their base role. */
  departmentHead?: boolean;
  /** Shows only for a department member who is not the head. */
  departmentMemberOnly?: boolean;
  /** Hidden for a department head or member, whose own row replaces it (a chef-head sees the head's History, a member the deliveries History, not the floor History). */
  hideForDepartmentHead?: boolean;
  /** The row is defined (label, group, who, where) but its page does not exist yet, so it is not shown. The slice that builds the page removes this flag. */
  notBuilt?: boolean;
  /** Shows only when the new clock is on for the person's branch (`NavContext.attendanceOn`). */
  needsAttendance?: boolean;
}

export interface NavSubRow extends Visibility {
  key: string;
  label: string;
  oldHref?: string;
  newHref?: string;
  framed?: boolean;
  /** Extra path prefixes that light this sub-link. */
  match?: readonly string[];
  /** Which count the shell puts on the sub-link (Runs carries the Needs a look count). */
  badge?: NavBadge;
}

export interface NavRow extends Visibility {
  key: string;
  label: string;
  /** Key into `NAV_GROUP_LABELS`. */
  group: string;
  icon: NavIcon;
  /** The page is still the old one. A row with sub-links has neither: it opens its first visible sub-link. */
  oldHref?: string;
  /** The page is rebuilt. */
  newHref?: string;
  /** The page draws its own top bar. Defaults to "has a newHref". */
  framed?: boolean;
  /** Extra path prefixes that light this row (a screen reached from it that has no link of its own). */
  match?: readonly string[];
  /** Which unread count the shell puts on the row. Counts come from each feature's public API, never from here. */
  badge?: NavBadge;
  /**
   * Floor staff only: the slot this row takes in the phone bottom bar, per role (1 is the first slot from the left). The bar is these
   * rows in that order, then a Menu slot that opens the drawer, so at most 4 per role (5 slots with Menu). A role with none has no bar.
   */
  quick?: Partial<Record<AppRole, number>>;
  /** The page has its own sticky action bar (a cart): the bottom bar is hidden on it. */
  hideBar?: boolean;
  /** Rows that follow the Central Store's preview role (System Admin demo bar) rather than the real role. */
  hub?: boolean;
  /** Replaced by one row per branch the shell fetches (the Director's list). `:id` in the href is filled in. */
  expand?: 'branches';
  subItems?: readonly NavSubRow[];
}

export const NAV_GROUP_LABELS: Readonly<Record<string, string>> = {
  'wf-home': 'HOME',
  'wf-team': 'TEAM',
  'wf-workforce': 'WORKFORCE',
  'wf-people': 'PEOPLE',
  'wf-pay': 'PAY',
  'wf-settings': 'SETTINGS',
  'wf-me': 'ME',
  'mgr-operations': 'OPERATIONS',
  'mgr-manage': 'MANAGE',
  'mgr-credit': 'CREDIT',
  'mgr-income': 'OTHER INCOME',
  'mgr-branch': 'BRANCH',
  'dir-overview': 'OVERVIEW',
  'dir-branches': 'BRANCHES',
  'dir-income': 'OTHER INCOME',
  'dir-operations': 'OPERATIONS',
  'dir-credit': 'CREDIT',
  'acc-financials': 'FINANCIALS',
  'acc-credit': 'CREDIT ACCOUNTS',
  'acc-comms': 'COMMUNICATIONS',
  'acc-leave': 'LEAVE',
  branches: 'BRANCHES',
  'adm-admin': 'ADMIN',
  'adm-comms': 'COMMUNICATIONS',
  hr: 'HR',
  'staff-nav': 'NAVIGATION',
  'staff-income': 'OTHER INCOME',
  'central-store': 'CENTRAL STORE',
  procurement: 'PROCUREMENT',
  department: 'DEPARTMENT',
  account: 'ACCOUNT',
};

const MANAGER: AppRole = 'MANAGER';
const DIRECTOR: AppRole = 'DIRECTOR';
const ACCOUNTANT: AppRole = 'ACCOUNTANT';
const SYSTEM_ADMIN: AppRole = 'SYSTEM_ADMIN';
const HR_MANAGER: AppRole = 'HR_MANAGER';
const STORE_MANAGER: AppRole = 'STORE_MANAGER';
const STORE_ATTENDANT: AppRole = 'STORE_ATTENDANT';
const WAITER: AppRole = 'WAITER';
const CHEF: AppRole = 'CHEF';
const BARISTA: AppRole = 'BARISTA';
const STEWARD: AppRole = 'STEWARD';
const HOUSEKEEPING: AppRole = 'HOUSEKEEPING';

/** The five desktop roles that read the Central Store from a desktop. */
const DESKTOP_HUB: readonly AppRole[] = [STORE_MANAGER, ACCOUNTANT, DIRECTOR, MANAGER, SYSTEM_ADMIN];
/** Those, plus the Attendant, who works the Central Store from a phone. */
const HUB_ALL: readonly AppRole[] = [...DESKTOP_HUB, STORE_ATTENDANT];
const ALL_HUMAN: readonly AppRole[] = [WAITER, CHEF, BARISTA, MANAGER, DIRECTOR, ACCOUNTANT, HR_MANAGER, SYSTEM_ADMIN, STEWARD, HOUSEKEEPING, STORE_MANAGER, STORE_ATTENDANT];
const SHIFT_STAFF: readonly AppRole[] = [WAITER, CHEF, BARISTA, STEWARD, HOUSEKEEPING];

// Bottom-bar slots shared by several rows (see `NavRow.quick`). The waiter has no Daily count slot: it stays in the drawer.
const DAILY_COUNT_SLOT: Partial<Record<AppRole, number>> = { [CHEF]: 2, [BARISTA]: 2, [STEWARD]: 2, [HOUSEKEEPING]: 2 };
const DELIVERIES_SLOT: Partial<Record<AppRole, number>> = { [WAITER]: 3, [CHEF]: 3, [BARISTA]: 3, [STEWARD]: 3, [HOUSEKEEPING]: 3 };
const INBOX_SLOT: Partial<Record<AppRole, number>> = { [WAITER]: 4, [CHEF]: 4, [BARISTA]: 4, [STEWARD]: 4, [HOUSEKEEPING]: 4 };

const ico = {
  dashboard: fromLucide(LayoutDashboard),
  orders: fromLucide(ShoppingCart),
  history: fromLucide(Clock),
  analytics: fromLucide(BarChart2),
  inbox: fromLucide(MessageSquare),
  staff: fromLucide(Users),
  departments: fromLucide(Building2),
  menu: fromLucide(UtensilsCrossed),
  shifts: fromLucide(Calendar),
  delivery: fromLucide(Bike),
  payslips: fromLucide(FileText),
  credit: fromLucide(CreditCard),
  alert: fromLucide(AlertTriangle),
  money: fromLucide(Banknote),
  profile: fromLucide(UserCircle),
  shield: fromLucide(ShieldAlert),
  percent: fromLucide(Percent),
  settings: fromLucide(Settings2),
  tags: fromLucide(Tags),
  chef: fromLucide(ChefHat),
  coffee: fromLucide(Coffee),
  leaveOff: fromLucide(CalendarOff),
  contracts: fromLucide(ScrollText),
  clipboard: fromLucide(ClipboardList),
  branch: fromLucide(GitBranch),
  analyticsLine: fromLucide(LineChart),
  truck: fromLucide(Truck),
  day: fromLucide(CalendarCheck),
  home: fromLucide(House),
  waiting: fromLucide(Inbox),
  timesheets: fromLucide(SquareCheckBig),
  organisation: fromLucide(Network),
  leave: fromLucide(Plane),
  rules: fromLucide(SlidersVertical),
  myTime: fromLucide(Clock),
  me: fromLucide(UserRound),
};

/** The five desktop roles of the Workforce menu (Paper Chapter 1, step 01). The System Admin has no Workforce menu yet. */
const WF_HR: AppRole = HR_MANAGER;
const WF_DESKTOP: readonly AppRole[] = [WF_HR, MANAGER, STORE_MANAGER, ACCOUNTANT, DIRECTOR];
/** Who sees what, as step 01 draws it. A row with no page yet carries `notBuilt` and stays hidden; each slice drops the flag with its page. */
const WF_APPROVERS: readonly AppRole[] = [WF_HR, MANAGER, STORE_MANAGER];
const WF_PEOPLE: readonly AppRole[] = [WF_HR, MANAGER, STORE_MANAGER, DIRECTOR];
const WF_PAY: readonly AppRole[] = [WF_HR, ACCOUNTANT, DIRECTOR];

/*
 * The Schedule rows, the Today board and the floor staff's Home link carry `needsAttendance`: they show only for a person whose branch has
 * the new clock switched on (`NavContext.attendanceOn`, from the Attendance switch). A branch that is off sees none of them, so nobody plans
 * a week the clock does not read yet. The pages still open by address for the roles the route gate lets in.
 */

export const WORKFORCE_ROWS: readonly NavRow[] = [
  // WORKFORCE
  { key: 'wf-home', label: 'Home', group: 'wf-workforce', icon: ico.home, newHref: '/app/workforce', roles: WF_DESKTOP },
  // The per-branch switch for the new clock: the System Admin's alone (owner, 18 Oct 2026). It has no Home, so this is its one Workforce row.
  { key: 'wf-attendance-switch', label: 'Attendance clock', group: 'wf-workforce', icon: ico.timesheets, newHref: '/app/workforce/attendance/switch', roles: [SYSTEM_ADMIN] },
  { key: 'wf-today', label: 'Today board', group: 'wf-workforce', icon: ico.timesheets, newHref: '/app/workforce/today', roles: [WF_HR, DIRECTOR], needsAttendance: true },
  { key: 'wf-waiting', label: 'Waiting for you', group: 'wf-workforce', icon: ico.waiting, newHref: '/app/workforce/waiting', roles: [...WF_APPROVERS, ACCOUNTANT], badge: 'workforce-waiting', notBuilt: true },
  { key: 'wf-overdue', label: 'Overdue approvals', group: 'wf-workforce', icon: ico.waiting, newHref: '/app/workforce/waiting', roles: [DIRECTOR], badge: 'workforce-waiting', notBuilt: true },
  {
    key: 'wf-schedule',
    label: 'Schedule',
    group: 'wf-workforce',
    icon: ico.shifts,
    roles: [...WF_APPROVERS, DIRECTOR],
    needsAttendance: true,
    subItems: [
      { key: 'rota', label: 'Rota', newHref: '/app/workforce/schedule/rota', roles: [...WF_APPROVERS, DIRECTOR] },
      { key: 'templates', label: 'Shift templates', newHref: '/app/workforce/schedule/templates', roles: [...WF_APPROVERS, DIRECTOR] },
    ],
  },
  // Timesheets and Requests (slice 4a): shown only where the branch's new clock is on, like the Schedule rows. The Accountant reads Timesheets and acts on nothing.
  { key: 'wf-timesheets', label: 'Timesheets', group: 'wf-workforce', icon: ico.timesheets, newHref: '/app/workforce/timesheets', roles: [...WF_APPROVERS, DIRECTOR, ACCOUNTANT], badge: 'workforce-timesheets', needsAttendance: true, match: ['/app/workforce/timesheets'] },
  { key: 'wf-requests', label: 'Requests', group: 'wf-workforce', icon: ico.waiting, newHref: '/app/workforce/requests', roles: [...WF_APPROVERS, DIRECTOR], needsAttendance: true },
  { key: 'wf-employees-acc', label: 'Employees', group: 'wf-workforce', icon: ico.staff, newHref: '/app/workforce/employees', roles: [ACCOUNTANT] },
  // PEOPLE
  { key: 'wf-employees', label: 'Employees', group: 'wf-people', icon: ico.staff, newHref: '/app/workforce/employees', roles: WF_PEOPLE, match: ['/app/workforce/employees'] },
  { key: 'wf-organisation', label: 'Organisation', group: 'wf-people', icon: ico.organisation, newHref: '/app/workforce/organisation', roles: [WF_HR, MANAGER, DIRECTOR], match: ['/app/workforce/organisation'] },
  { key: 'wf-leave', label: 'Leave', group: 'wf-people', icon: ico.leave, newHref: '/app/workforce/leave', roles: WF_PEOPLE, badge: 'workforce-leave', notBuilt: true },
  { key: 'wf-conduct', label: 'Conduct', group: 'wf-people', icon: ico.shield, newHref: '/app/workforce/conduct', roles: WF_PEOPLE, notBuilt: true },
  // PAY (the Branch Manager and Store Manager see no pay)
  { key: 'wf-pay-runs', label: 'Pay runs', group: 'wf-pay', icon: ico.money, newHref: '/app/workforce/pay-runs', roles: WF_PAY, notBuilt: true },
  { key: 'wf-payslips', label: 'Payslips', group: 'wf-pay', icon: ico.payslips, newHref: '/app/workforce/payslips', roles: WF_PAY, notBuilt: true },
  // SETTINGS
  { key: 'wf-rules', label: 'Rules', group: 'wf-settings', icon: ico.rules, newHref: '/app/workforce/rules', roles: WF_DESKTOP, notBuilt: true },
  { key: 'wf-audit-log', label: 'Audit log', group: 'wf-settings', icon: AuditLogIcon, newHref: '/app/workforce/audit-log', roles: WF_DESKTOP, notBuilt: true },
  // ME
  { key: 'wf-my-time', label: 'My time', group: 'wf-me', icon: ico.myTime, newHref: '/app/workforce/my-time', roles: [ACCOUNTANT], needsAttendance: true, match: ['/app/workforce/my-time'] },
  { key: 'wf-my-leave', label: 'My leave', group: 'wf-me', icon: ico.me, newHref: '/app/workforce/my-leave', roles: WF_DESKTOP, notBuilt: true },
  { key: 'wf-my-payslips', label: 'My payslips', group: 'wf-me', icon: ico.payslips, newHref: '/app/workforce/my-payslips', roles: WF_DESKTOP, notBuilt: true },

  // ── The phone drawer of floor staff and department heads (Paper Chapter 1 step 06: Home, Job, Team, Inbox, Me) ──────────────────
  // Not shown: the Workforce Home link for floor staff waits for Attendance (slice 3), which gives their Home a clock card. Job and Inbox
  // are the legacy rows above until the Orders redo. The route gate keeps these roles out of /app/workforce until the slice that builds each page widens it.
  { key: 'wf-staff-home', label: 'Home', group: 'wf-home', icon: ico.home, newHref: '/app/workforce', roles: [...SHIFT_STAFF, STORE_ATTENDANT], needsAttendance: true },
  { key: 'wf-head-waiting', label: 'Waiting for you', group: 'wf-team', icon: ico.waiting, newHref: '/app/workforce/waiting', roles: SHIFT_STAFF, departmentHead: true, badge: 'workforce-waiting', notBuilt: true },
  { key: 'wf-head-today', label: 'Team today', group: 'wf-team', icon: ico.staff, newHref: '/app/workforce/today', roles: SHIFT_STAFF, departmentHead: true, needsAttendance: true },
  { key: 'wf-head-rota', label: 'Rota', group: 'wf-team', icon: ico.shifts, newHref: '/app/workforce/schedule/rota', roles: SHIFT_STAFF, departmentHead: true, needsAttendance: true },
  { key: 'wf-head-timesheets', label: 'Timesheets', group: 'wf-team', icon: ico.timesheets, newHref: '/app/workforce/timesheets', roles: SHIFT_STAFF, departmentHead: true, needsAttendance: true, match: ['/app/workforce/timesheets'] },
  { key: 'wf-head-casuals', label: 'Casuals', group: 'wf-team', icon: ico.me, newHref: '/app/workforce/casuals', roles: SHIFT_STAFF, departmentHead: true, notBuilt: true },
  // My time (slice 4a): hours and days, my rota, and the requests I have sent. Only where the branch's new clock is on.
  {
    key: 'wf-staff-my-time',
    label: 'My time',
    group: 'wf-me',
    icon: ico.myTime,
    roles: [...SHIFT_STAFF, STORE_ATTENDANT],
    needsAttendance: true,
    match: ['/app/workforce/my-time'],
    subItems: [
      { key: 'hours', label: 'Hours this month', newHref: '/app/workforce/my-time', roles: [...SHIFT_STAFF, STORE_ATTENDANT] },
      { key: 'rota', label: 'My rota', newHref: '/app/workforce/my-time/rota', roles: [...SHIFT_STAFF, STORE_ATTENDANT] },
      { key: 'requests', label: 'My requests', newHref: '/app/workforce/my-time/requests', roles: [...SHIFT_STAFF, STORE_ATTENDANT] },
    ],
  },
  { key: 'wf-staff-my-leave', label: 'My leave', group: 'wf-me', icon: ico.leave, newHref: '/app/workforce/my-leave', roles: SHIFT_STAFF, notBuilt: true },
  { key: 'wf-staff-my-payslips', label: 'My payslips', group: 'wf-me', icon: ico.payslips, newHref: '/app/workforce/my-payslips', roles: SHIFT_STAFF, notBuilt: true },
  { key: 'wf-staff-profile', label: 'Profile and security', group: 'wf-me', icon: ico.shield, newHref: '/app/profile', roles: SHIFT_STAFF, notBuilt: true },
];

export const NAV_ROWS: readonly NavRow[] = [
  // ── Workforce (Chapter 1): first for the five desktop roles, as Paper draws it. Legacy rows below stay until each slice moves its own. ──
  ...WORKFORCE_ROWS,

  // ── Branch Manager ────────────────────────────────────────────────────────────────────────────────────────────────────────
  { key: 'manage-dashboard', label: 'Dashboard', group: 'mgr-operations', icon: ico.dashboard, oldHref: '/app/manage/dashboard', roles: [MANAGER] },
  { key: 'manage-orders', label: 'Orders', group: 'mgr-operations', icon: ico.orders, oldHref: '/app/orders', roles: [MANAGER] },
  { key: 'manage-history', label: 'History', group: 'mgr-operations', icon: ico.history, oldHref: '/app/history', roles: [MANAGER] },
  { key: 'manage-analytics', label: 'Analytics', group: 'mgr-operations', icon: ico.analytics, oldHref: '/app/manage/reports', roles: [MANAGER] },
  { key: 'manage-inbox', label: 'Inbox', group: 'mgr-operations', icon: ico.inbox, oldHref: '/app/inbox', roles: [MANAGER], badge: 'inbox' },
  // Paper step 20: Departments in Settings (add, rename, retire). The old heads page stays at /app/manage/departments until its own redo.
  { key: 'manage-departments', label: 'Departments', group: 'mgr-manage', icon: ico.departments, newHref: '/app/manage/department-settings', roles: [MANAGER] },
  // Block 2: the Branch Manager reads the carrier list (read only) to see who carries the branch's deliveries.
  { key: 'manage-carriers', label: 'Carriers', group: 'mgr-manage', icon: ico.truck, newHref: '/app/inventory/carriers', roles: [MANAGER], capability: 'carriers.read' },
  { key: 'manage-menu', label: 'Menu', group: 'mgr-manage', icon: ico.menu, oldHref: '/app/manage/menu', roles: [MANAGER] },
  { key: 'manage-shifts', label: 'Shifts', group: 'mgr-manage', icon: ico.shifts, oldHref: '/app/manage/shifts', roles: [MANAGER] },
  { key: 'manage-delivery-zones', label: 'Delivery Zones', group: 'mgr-manage', icon: ico.delivery, oldHref: '/app/manage/delivery-zones', roles: [MANAGER] },
  { key: 'manage-payslips', label: 'Payslips', group: 'mgr-manage', icon: ico.payslips, oldHref: '/app/manage/payslips', roles: [MANAGER] },
  { key: 'manage-incidents', label: 'Incidents', group: 'mgr-manage', icon: ico.alert, oldHref: '/app/manage/incidents', roles: [MANAGER] },
  { key: 'manage-customer-credit', label: 'Customer Credit', group: 'mgr-credit', icon: ico.credit, oldHref: '/app/manage/customer-credit', roles: [MANAGER], flag: 'credit' },
  { key: 'manage-outstanding', label: 'Outstanding Balances', group: 'mgr-credit', icon: ico.alert, oldHref: '/app/manage/outstanding-balances', roles: [MANAGER], flag: 'credit' },
  { key: 'manage-my-tab', label: 'My Tab', group: 'mgr-credit', icon: ico.credit, oldHref: '/app/manage/my-tab', roles: [MANAGER], flag: 'credit' },
  { key: 'income-record', label: 'Record Income', group: 'mgr-income', icon: ico.money, oldHref: '/app/other-income/new', roles: [MANAGER] },
  { key: 'income-entries', label: 'Income Entries', group: 'mgr-income', icon: ico.history, oldHref: '/app/other-income/history', roles: [MANAGER] },
  // The Branch workspace is rebuilt: its screens draw their own top bar.
  // One Requisitions row with Queue, Discrepancies and History; the Deliveries row is gone (folded into the Queue tabs).
  {
    key: 'branch-requisitions',
    label: 'Requisitions',
    group: 'mgr-branch',
    icon: ico.clipboard,
    roles: [MANAGER],
    badge: 'requisitions',
    subItems: [
      { key: 'queue', label: 'Queue', newHref: '/app/branch/requisitions', roles: [MANAGER], badge: 'requisitions' },
      { key: 'discrepancies', label: 'Discrepancies', newHref: '/app/branch/requisitions/discrepancies', roles: [MANAGER], badge: 'discrepancies' },
      { key: 'history', label: 'History', newHref: '/app/branch/requisitions/history', roles: [MANAGER] },
    ],
  },
  // Block 4 (Paper B5 to B13): Today (and a department's figures) and History (and the closed day file), the Branch Manager's own branch.
  {
    key: 'branch-day',
    label: 'Day',
    group: 'mgr-branch',
    icon: ico.day,
    roles: [MANAGER],
    capability: 'branch_day.read',
    subItems: [
      // The number of things that block the close (Paper B5 draws it on Today; none when nothing blocks).
      { key: 'today', label: 'Today', newHref: '/app/branch/day', roles: [MANAGER], badge: 'branch-day-todo' },
      { key: 'history', label: 'History', newHref: '/app/branch/day/history', roles: [MANAGER], match: ['/app/branch/day/file'] },
    ],
  },
  // Block 3 (Paper W6): the Branch Manager reads the branch's waste with values and reverses any entry.
  { key: 'branch-waste', label: 'Waste', group: 'mgr-branch', icon: ico.alert, newHref: '/app/inventory/branch-waste', roles: [MANAGER], capability: 'branch_waste.read' },
  // Block 4 (gap G25): the same Audit log screen, scoped by the server to the Branch Manager's own branch.
  { key: 'branch-audit-log', label: 'Audit log', group: 'mgr-branch', icon: AuditLogIcon, newHref: '/app/inventory/audit-log', roles: [MANAGER], capability: 'audit.read' },

  // ── Director ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
  { key: 'director-dashboard', label: 'Dashboard', group: 'dir-overview', icon: ico.dashboard, oldHref: '/app/director', roles: [DIRECTOR] },
  { key: 'director-analytics', label: 'Analytics', group: 'dir-overview', icon: ico.analyticsLine, oldHref: '/app/director/analytics', roles: [DIRECTOR] },
  { key: 'director-inbox', label: 'Inbox', group: 'dir-overview', icon: ico.inbox, oldHref: '/app/inbox', roles: [DIRECTOR], badge: 'inbox' },
  // Block 4 (Paper B16): every branch's day, read only, with a branch picker.
  {
    key: 'director-day',
    label: 'Day',
    group: 'dir-branches',
    icon: ico.day,
    roles: [DIRECTOR],
    capability: 'branch_day.read_any_branch',
    subItems: [
      { key: 'today', label: 'Today', newHref: '/app/inventory/branch-day', roles: [DIRECTOR] },
      { key: 'history', label: 'History', newHref: '/app/inventory/branch-day/history', roles: [DIRECTOR], match: ['/app/inventory/branch-day/file'] },
    ],
  },
  // Block 3 (Paper W8): every branch's waste, read only.
  { key: 'director-waste', label: 'Waste', group: 'dir-branches', icon: ico.alert, newHref: '/app/inventory/branch-waste', roles: [DIRECTOR], capability: 'branch_waste.read_any_branch' },
  { key: 'director-income', label: 'Categories & Entries', group: 'dir-income', icon: ico.tags, oldHref: '/app/director/other-income', roles: [DIRECTOR] },
  { key: 'director-incidents', label: 'Incident Log', group: 'dir-operations', icon: ico.shield, oldHref: '/app/director/incidents', roles: [DIRECTOR] },
  { key: 'director-discounts', label: 'Discounts', group: 'dir-operations', icon: ico.percent, oldHref: '/app/admin/discounts', roles: [DIRECTOR] },
  // Branch Settings is an existing page; Departments (Paper G4, read only with a branch picker) sits under it.
  {
    key: 'director-settings',
    label: 'Branch Settings',
    group: 'dir-operations',
    icon: ico.settings,
    roles: [DIRECTOR],
    subItems: [
      { key: 'settings', label: 'Settings', oldHref: '/app/director/settings', roles: [DIRECTOR] },
      { key: 'departments', label: 'Departments', newHref: '/app/director/settings/departments', roles: [DIRECTOR], capability: 'departments.read' },
    ],
  },
  { key: 'director-payroll', label: 'Payroll', group: 'dir-operations', icon: ico.payslips, oldHref: '/app/hr/payroll', roles: [DIRECTOR] },
  { key: 'director-corporate', label: 'Corporate Accounts', group: 'dir-credit', icon: ico.departments, oldHref: '/app/director/corporate-accounts', roles: [DIRECTOR], flag: 'credit' },
  { key: 'director-outstanding', label: 'Outstanding Balances', group: 'dir-credit', icon: ico.alert, oldHref: '/app/director/outstanding-balances', roles: [DIRECTOR], flag: 'credit' },
  { key: 'director-my-tab', label: 'My Tab', group: 'dir-credit', icon: ico.credit, oldHref: '/app/manage/my-tab', roles: [DIRECTOR], flag: 'credit' },

  // ── Accountant ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  { key: 'accountant-dashboard', label: 'Dashboard', group: 'acc-financials', icon: ico.dashboard, oldHref: '/app/accountant', roles: [ACCOUNTANT] },
  { key: 'accountant-reconciliation', label: 'Reconciliation', group: 'acc-financials', icon: ico.history, oldHref: '/app/accountant/reconciliation', roles: [ACCOUNTANT] },
  { key: 'accountant-income', label: 'Other Income', group: 'acc-financials', icon: ico.money, oldHref: '/app/other-income/history', roles: [ACCOUNTANT] },
  { key: 'accountant-payments', label: 'My Payments', group: 'acc-financials', icon: ico.payslips, oldHref: '/app/payslips', roles: [ACCOUNTANT] },
  { key: 'accountant-credit', label: 'Credit Accounts', group: 'acc-credit', icon: ico.credit, oldHref: '/app/accountant/credit', roles: [ACCOUNTANT] },
  { key: 'accountant-inbox', label: 'Inbox', group: 'acc-comms', icon: ico.inbox, oldHref: '/app/inbox', roles: [ACCOUNTANT], badge: 'inbox' },
  { key: 'accountant-leave', label: 'My Leave', group: 'acc-leave', icon: ico.leaveOff, oldHref: '/app/hr/my-leave', roles: [ACCOUNTANT] },

  // ── System Admin ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  { key: 'admin-branches', label: 'Branches & Users', group: 'adm-admin', icon: ico.settings, oldHref: '/app/admin', roles: [SYSTEM_ADMIN] },
  { key: 'admin-menu', label: 'Menu', group: 'adm-admin', icon: ico.menu, oldHref: '/app/admin/menu', roles: [SYSTEM_ADMIN] },
  { key: 'admin-house-accounts', label: 'House Accounts', group: 'adm-admin', icon: ico.credit, oldHref: '/app/admin/house-accounts', roles: [SYSTEM_ADMIN], flag: 'credit' },
  { key: 'admin-corporate', label: 'Corporate Accounts', group: 'adm-admin', icon: ico.departments, oldHref: '/app/admin/corporate-accounts', roles: [SYSTEM_ADMIN], flag: 'credit' },
  { key: 'admin-inbox', label: 'Inbox', group: 'adm-comms', icon: ico.inbox, oldHref: '/app/inbox', roles: [SYSTEM_ADMIN], badge: 'inbox' },

  // ── Branches (Block 3, Paper W8): the desktop roles without a branch of their own read every branch's waste ─────────────────
  {
    key: 'branches-day',
    label: 'Day',
    group: 'branches',
    icon: ico.day,
    roles: [ACCOUNTANT, STORE_MANAGER, SYSTEM_ADMIN],
    capability: 'branch_day.read_any_branch',
    subItems: [
      { key: 'today', label: 'Today', newHref: '/app/inventory/branch-day', roles: [ACCOUNTANT, STORE_MANAGER, SYSTEM_ADMIN] },
      { key: 'history', label: 'History', newHref: '/app/inventory/branch-day/history', roles: [ACCOUNTANT, STORE_MANAGER, SYSTEM_ADMIN], match: ['/app/inventory/branch-day/file'] },
    ],
  },
  { key: 'branches-waste', label: 'Waste', group: 'branches', icon: ico.alert, newHref: '/app/inventory/branch-waste', roles: [ACCOUNTANT, STORE_MANAGER, SYSTEM_ADMIN], capability: 'branch_waste.read_any_branch' },

  // ── HR Manager ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  { key: 'hr-overview', label: 'HR Overview', group: 'hr', icon: ico.dashboard, oldHref: '/app/hr', roles: [HR_MANAGER] },
  { key: 'hr-contracts', label: 'Contract Types', group: 'hr', icon: ico.contracts, oldHref: '/app/hr/contract-types', roles: [HR_MANAGER] },
  { key: 'hr-leave', label: 'Leave Requests', group: 'hr', icon: ico.shifts, oldHref: '/app/hr/leave', roles: [HR_MANAGER] },
  { key: 'hr-leave-calendar', label: 'Leave Calendar', group: 'hr', icon: ico.shifts, oldHref: '/app/hr/leave/calendar', roles: [HR_MANAGER] },
  { key: 'hr-attendance', label: 'Attendance', group: 'hr', icon: ico.analytics, oldHref: '/app/hr/attendance', roles: [HR_MANAGER] },
  { key: 'hr-shifts', label: 'Shifts', group: 'hr', icon: ico.shifts, oldHref: '/app/hr/shifts', roles: [HR_MANAGER] },
  { key: 'hr-payroll', label: 'Payroll', group: 'hr', icon: ico.payslips, oldHref: '/app/hr/payroll', roles: [HR_MANAGER] },
  { key: 'hr-inbox', label: 'Inbox', group: 'hr', icon: ico.inbox, oldHref: '/app/inbox', roles: [HR_MANAGER], badge: 'inbox' },

  // ── Floor and kitchen staff (the desktop preview, and any desktop session) ───────────────────────────────────────────────
  { key: 'staff-dashboard', label: 'Dashboard', group: 'staff-nav', icon: ico.dashboard, oldHref: '/app/dashboard', roles: SHIFT_STAFF, quick: { [STEWARD]: 1, [HOUSEKEEPING]: 1 } },
  // The phone bottom bar (`quick`): waiter New Order, Orders; chef Kitchen; barista Barista. New Order has its own sticky cart, so no bar there.
  { key: 'staff-new-order', label: 'New Order', group: 'staff-nav', icon: ico.orders, oldHref: '/app/orders/new', roles: [WAITER], quick: { [WAITER]: 1 }, hideBar: true },
  { key: 'staff-orders', label: 'Orders', group: 'staff-nav', icon: ico.clipboard, oldHref: '/app/orders', roles: [WAITER], quick: { [WAITER]: 2 } },
  { key: 'staff-kitchen', label: 'Kitchen', group: 'staff-nav', icon: ico.chef, oldHref: '/app/kitchen', roles: [CHEF], quick: { [CHEF]: 1 } },
  { key: 'staff-barista', label: 'Barista', group: 'staff-nav', icon: ico.coffee, oldHref: '/app/barista', roles: [BARISTA], quick: { [BARISTA]: 1 } },
  { key: 'staff-shifts', label: 'Shifts', group: 'staff-nav', icon: ico.shifts, oldHref: '/app/shifts', roles: SHIFT_STAFF },
  { key: 'staff-leave', label: 'My Leave', group: 'staff-nav', icon: ico.leaveOff, oldHref: '/app/hr/my-leave', roles: SHIFT_STAFF },
  { key: 'staff-payslips', label: 'Payslips', group: 'staff-nav', icon: ico.payslips, oldHref: '/app/payslips', roles: SHIFT_STAFF },
  { key: 'staff-performance', label: 'Performance', group: 'staff-nav', icon: ico.analytics, oldHref: '/app/performance', roles: [WAITER, CHEF, BARISTA] },
  { key: 'staff-history', label: 'History', group: 'staff-nav', icon: ico.history, oldHref: '/app/history', roles: [CHEF, BARISTA], hideForDepartmentHead: true },
  // The waiter's own order history (tips and sales) shows for every waiter, department or not; a department member's Deliveries History is a different page.
  { key: 'staff-order-history', label: 'Order History', group: 'staff-nav', icon: ico.history, oldHref: '/app/history', roles: [WAITER] },
  { key: 'staff-inbox', label: 'Inbox', group: 'staff-nav', icon: ico.inbox, oldHref: '/app/inbox', roles: SHIFT_STAFF, badge: 'inbox', quick: INBOX_SLOT },
  { key: 'staff-income-record', label: 'Record Income', group: 'staff-income', icon: ico.money, oldHref: '/app/other-income/new', roles: [WAITER] },
  { key: 'staff-income-history', label: 'Income History', group: 'staff-income', icon: ico.history, oldHref: '/app/other-income/history', roles: [WAITER] },

  // ── Central Store (every desktop role reads it; the server's permissions table decides what each may open) ──────────────
  // Purchasing and Receiving are one flow on the mock: every desktop role reads it, the phone roles reach it through the order capabilities.
  { key: 'receiving', label: 'Receiving', group: 'central-store', icon: ReceivingIcon, newHref: '/app/inventory/receiving', roles: HUB_ALL, anyCapability: ['orders.read', 'orders.receive'], hub: true, badge: 'purchasing-receiving' },
  { key: 'purchasing', label: 'Purchasing', group: 'central-store', icon: PurchasingIcon, newHref: '/app/inventory/purchasing', roles: DESKTOP_HUB, anyCapability: ['orders.read', 'orders.request'], hub: true },
  // The Store Attendant's Purchasing phone (Paper 28I): the same link with five sub-links. Only one of the two rows shows for a role.
  {
    key: 'purchasing',
    label: 'Purchasing',
    group: 'central-store',
    icon: PurchasingIcon,
    roles: [STORE_ATTENDANT],
    anyCapability: ['orders.read', 'orders.request'],
    hub: true,
    subItems: [
      { key: 'purchasing-home', label: 'Home', newHref: '/app/inventory/purchasing', roles: [STORE_ATTENDANT] },
      { key: 'purchasing-restock', label: 'Restock list', newHref: '/app/inventory/purchasing/restock', roles: [STORE_ATTENDANT], badge: 'purchasing-restock' },
      { key: 'purchasing-new', label: 'New order', newHref: '/app/inventory/purchasing/new', roles: [STORE_ATTENDANT] },
      { key: 'purchasing-my-orders', label: 'My orders', newHref: '/app/inventory/purchasing/my-orders', roles: [STORE_ATTENDANT], badge: 'purchasing-my-orders' },
      { key: 'purchasing-history', label: 'History', newHref: '/app/inventory/purchasing/history', roles: [STORE_ATTENDANT] },
      { key: 'purchasing-levels', label: 'Restock levels', newHref: '/app/inventory/purchasing/levels', roles: [STORE_ATTENDANT] },
    ],
  },
  {
    key: 'prep',
    label: 'Prep',
    group: 'central-store',
    icon: PrepIcon,
    roles: HUB_ALL,
    capability: 'prep.read',
    hub: true,
    // Shown on the parent only while it is shut, and on Runs while it is open (the sidebar decides); the count is GET /needs-a-look/count, and a zero draws nothing.
    badge: 'prep-needs-look',
    // The three sub-links of the Prep rebuild, all rebuilt now; every desktop role reads them and the Attendant sees all three.
    subItems: [
      { key: 'runs', label: 'Runs', newHref: '/app/inventory/prep', roles: HUB_ALL, badge: 'prep-needs-look' },
      { key: 'usual-recipes', label: 'Usual recipes', newHref: '/app/inventory/prep/recipes', roles: HUB_ALL },
      { key: 'history', label: 'History', newHref: '/app/inventory/prep/history', roles: HUB_ALL },
    ],
  },
  // One Requisitions row for the hub desktop roles (it replaces Dispatch for them); the Branch Manager has the Branch group's own row.
  {
    key: 'requisitions',
    label: 'Requisitions',
    group: 'central-store',
    icon: ico.clipboard,
    roles: [STORE_MANAGER, ACCOUNTANT, DIRECTOR, SYSTEM_ADMIN],
    capability: 'requisitions.read',
    hub: true,
    badge: 'discrepancies',
    subItems: [
      { key: 'queue', label: 'Queue', newHref: '/app/inventory/requisitions', roles: [STORE_MANAGER, ACCOUNTANT, DIRECTOR, SYSTEM_ADMIN] },
      { key: 'discrepancies', label: 'Discrepancies', newHref: '/app/inventory/requisitions/discrepancies', roles: [STORE_MANAGER, ACCOUNTANT, DIRECTOR, SYSTEM_ADMIN], badge: 'discrepancies' },
      { key: 'history', label: 'History', newHref: '/app/inventory/requisitions/history', roles: [STORE_MANAGER, ACCOUNTANT, DIRECTOR, SYSTEM_ADMIN] },
    ],
  },
  // The Attendant has one Dispatch row (To pack, On the way, Done and the pack screens live under it).
  { key: 'dispatch', label: 'Dispatch', group: 'central-store', icon: DispatchIcon, newHref: '/app/inventory/dispatch', roles: [STORE_ATTENDANT], hub: true },
  {
    key: 'stock-counts',
    label: 'Stock & counts',
    group: 'central-store',
    icon: StockCountsIcon,
    match: ['/app/inventory/stock'],
    roles: HUB_ALL,
    hub: true,
    // A parent shows when one of its sub-links does and opens the first of them. "Overview" is the default for any stock page without a link of its own.
    subItems: [
      { key: 'overview', label: 'Overview', newHref: '/app/inventory/stock', roles: DESKTOP_HUB, capability: 'stock.read' },
      { key: 'items', label: 'All items', newHref: '/app/inventory/stock/items', roles: DESKTOP_HUB, capability: 'stock.read' },
      // One Counts link for everyone: a reader gets the Counts list, a counter without read access gets Pick a section (the page decides from the server's data).
      { key: 'counts', label: 'Counts', newHref: '/app/inventory/stock/counts', roles: HUB_ALL, anyCapability: ['counts.read', 'counts.record'] },
      { key: 'waste', label: 'Waste', newHref: '/app/inventory/stock/waste', roles: HUB_ALL, capability: 'waste.read' },
      { key: 'ledger', label: 'Stock ledger', newHref: '/app/inventory/stock/ledger', roles: DESKTOP_HUB, capability: 'stock.read' },
      { key: 'restock-levels', label: 'Restock levels', newHref: '/app/inventory/stock/restock-levels', roles: DESKTOP_HUB, capability: 'restock.read' },
    ],
  },
  { key: 'suppliers', label: 'Suppliers', group: 'procurement', icon: SuppliersIcon, newHref: '/app/inventory/suppliers', roles: DESKTOP_HUB, capability: 'suppliers.read', hub: true },
  { key: 'catalog', label: 'Catalog', group: 'procurement', icon: CatalogIcon, newHref: '/app/inventory/catalog', roles: HUB_ALL, capability: 'catalog.read', hub: true },
  // The Branch Manager has the 'branch-audit-log' row above (the same screen), so the hub row leaves them out: one link, not two.
  { key: 'audit-log', label: 'Audit log', group: 'procurement', icon: AuditLogIcon, newHref: '/app/inventory/audit-log', roles: DESKTOP_HUB.filter((r) => r !== MANAGER), capability: 'audit.read', hub: true },
  // Carriers (Paper D18, Block 2): the Store Manager and System Admin manage the list, the Director and Accountant read it (the page decides from `can.manage`).
  { key: 'carriers', label: 'Carriers', group: 'procurement', icon: ico.truck, newHref: '/app/inventory/carriers', roles: [STORE_MANAGER, DIRECTOR, ACCOUNTANT, SYSTEM_ADMIN], capability: 'carriers.read', hub: true },
  // The Store Manager's alone, until a later session moves it onto the table. Not drawn in Paper.
  { key: 'inventory-settings', label: 'Settings', group: 'procurement', icon: SettingsIcon, oldHref: '/app/inventory/settings', framed: true, roles: [STORE_MANAGER], hub: true },

  // ── A department head, on top of their own role's links ──────────────────────────────────────────────────────────────────
  { key: 'department-shifts', label: 'Department Shifts', group: 'department', icon: ico.shifts, oldHref: '/app/department/shifts', roles: ALL_HUMAN, departmentHead: true },
  // The head's Requisitions screens are rebuilt (phone column, own header). Deliveries and Waste stay links to the pages that exist today.
  { key: 'department-requisitions', label: 'Requisitions', group: 'department', icon: ico.clipboard, newHref: '/app/requisitions', roles: ALL_HUMAN, departmentHead: true },
  { key: 'department-deliveries', label: 'Deliveries', group: 'department', icon: ico.truck, newHref: '/app/deliveries', roles: ALL_HUMAN, departmentHead: true, badge: 'deliveries', quick: DELIVERIES_SLOT },
  // A department member (not a head) has the same two rows (Paper "Phone menus by role"): Deliveries and its History.
  // Block 4: the Day (check the opening, count tonight) is the row below. Waste follows (Block 3).
  { key: 'department-day', label: 'Daily count', group: 'department', icon: ico.day, newHref: '/app/day', roles: ALL_HUMAN, departmentHead: true, quick: DAILY_COUNT_SLOT, hideBar: true },
  { key: 'department-past-days', label: 'Past days', group: 'department', icon: ico.history, newHref: '/app/day/history', roles: ALL_HUMAN, departmentHead: true },
  { key: 'member-day', label: 'Daily count', group: 'department', icon: ico.day, newHref: '/app/day', roles: SHIFT_STAFF, departmentMemberOnly: true, quick: DAILY_COUNT_SLOT, hideBar: true },
  { key: 'member-deliveries', label: 'Deliveries', group: 'department', icon: ico.truck, newHref: '/app/deliveries', roles: SHIFT_STAFF, departmentMemberOnly: true, badge: 'deliveries', quick: DELIVERIES_SLOT },
  { key: 'member-history', label: 'History', group: 'department', icon: ico.history, newHref: '/app/deliveries/history', roles: SHIFT_STAFF, departmentMemberOnly: true },
  { key: 'department-waste', label: 'Waste', group: 'department', icon: ico.alert, newHref: '/app/waste', roles: ALL_HUMAN, departmentHead: true },
  // Block 3: a department member logs waste and reads the department's list too (Paper "Phone menus by role").
  { key: 'member-waste', label: 'Waste', group: 'department', icon: ico.alert, newHref: '/app/waste', roles: SHIFT_STAFF, departmentMemberOnly: true },
  // The head's requisition History is no menu row any more: the Requisitions home carries "Earlier" and "See all history" (11 Oct 2026).

  // ── Everyone ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  { key: 'profile', label: 'Profile', group: 'account', icon: ico.profile, oldHref: '/app/profile', roles: ALL_HUMAN },
];

// ── What the sidebar is built from ───────────────────────────────────────────────────────────────────────────────────────────

export interface NavContext {
  role: AppRole | undefined;
  /** The role the Central Store acts as: the System Admin's preview role, otherwise `role`. */
  hubRole?: AppRole;
  isDepartmentHead: boolean;
  /** An active member of a department who is not its head (from `GET /inventory/permissions/me`, `departments`). */
  isDepartmentMember?: boolean;
  /** `can` from the Central Store permissions table. */
  can: (capability: Capability) => boolean;
  /** `NEXT_PUBLIC_CREDIT_ACCOUNTS_ENABLED`. */
  creditAccounts: boolean;
  /** The Director's branches, for the rows that expand. */
  branches?: ReadonlyArray<{ id: string; name: string }>;
  /** The new clock is on for the person's branch (for a company-wide role, for any branch they can see). Absent means off. */
  attendanceOn?: boolean;
}

export interface NavLinkSub {
  key: string;
  label: string;
  href: string;
  framed: boolean;
  match: readonly string[];
  badge?: NavBadge;
}

export interface NavLink {
  key: string;
  label: string;
  href: string;
  icon: NavIcon;
  framed: boolean;
  match: readonly string[];
  badge?: NavBadge;
  /** Slot in the phone bottom bar for this person's role, when the row is a quick link. */
  quick?: number;
  hideBar?: boolean;
  subItems?: NavLinkSub[];
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavLink[];
}

const visible = (rule: Visibility, actor: AppRole, ctx: NavContext): boolean =>
  !rule.notBuilt &&
  (!rule.needsAttendance || ctx.attendanceOn === true) &&
  rule.roles.includes(actor) &&
  (!rule.capability || ctx.can(rule.capability)) &&
  (!rule.anyCapability || rule.anyCapability.some(ctx.can)) &&
  (rule.flag !== 'credit' || ctx.creditAccounts) &&
  (!rule.departmentHead || ctx.isDepartmentHead) &&
  (!rule.departmentMemberOnly || (ctx.isDepartmentMember === true && !ctx.isDepartmentHead)) &&
  (!rule.hideForDepartmentHead || !(ctx.isDepartmentHead || ctx.isDepartmentMember === true));

/** The badge a person may see: dropped when the badge needs a capability they do not hold. */
const badgeFor = (badge: NavBadge | undefined, ctx: NavContext): NavBadge | undefined => {
  if (!badge) return undefined;
  const needs = BADGE_CAPABILITY[badge];
  return needs && !ctx.can(needs) ? undefined : badge;
};

const hrefOf = (row: { oldHref?: string; newHref?: string }): string => row.newHref ?? row.oldHref ?? '#';

/** The sidebar for one person: the rows they may see, grouped, in table order. Pure, so it can be tested without a browser. */
export function navFor(ctx: NavContext, rows: readonly NavRow[] = NAV_ROWS): NavGroup[] {
  if (!ctx.role) return [];
  const groups = new Map<string, NavLink[]>();
  const add = (groupKey: string, link: NavLink): void => {
    const items = groups.get(groupKey);
    if (items) items.push(link);
    else groups.set(groupKey, [link]);
  };

  for (const row of rows) {
    const actor = row.hub ? (ctx.hubRole ?? ctx.role) : ctx.role;
    if (!visible(row, actor, ctx)) continue;
    const framed = row.framed ?? Boolean(row.newHref);
    const match = row.match ?? [];

    if (row.expand === 'branches') {
      for (const branch of ctx.branches ?? []) {
        add(row.group, { key: `${row.key}-${branch.id}`, label: branch.name, href: hrefOf(row).replace(':id', branch.id), icon: row.icon, framed, match });
      }
      continue;
    }

    if (row.subItems) {
      const subItems = row.subItems
        .filter((sub) => visible(sub, actor, ctx))
        .map((sub): NavLinkSub => ({ key: sub.key, label: sub.label, href: hrefOf(sub), framed: sub.framed ?? Boolean(sub.newHref), match: sub.match ?? [], badge: badgeFor(sub.badge, ctx) }));
      const first = subItems[0];
      if (first) add(row.group, { key: row.key, label: row.label, href: first.href, icon: row.icon, framed, match, badge: badgeFor(row.badge, ctx), subItems });
      continue;
    }

    add(row.group, { key: row.key, label: row.label, href: hrefOf(row), icon: row.icon, framed, match, badge: badgeFor(row.badge, ctx), quick: row.quick?.[actor], hideBar: row.hideBar });
  }

  return Array.from(groups.entries()).map(([key, items]) => ({ key, label: NAV_GROUP_LABELS[key] ?? key.toUpperCase(), items }));
}

/** The phone bottom bar's links for one person: the rows that have a slot for their role, in slot order. Empty means no bar. */
export function quickLinksFor(groups: readonly NavGroup[]): NavLink[] {
  return groups
    .flatMap((group) => group.items)
    .filter((link) => link.quick !== undefined)
    .sort((a, b) => (a.quick ?? 0) - (b.quick ?? 0));
}

/**
 * Whether the bottom bar shows on this page: only on a page the menu links to, never on a task screen reached from one (a count, a
 * confirm, a send sheet) or on a row that draws its own sticky bar (`hideBar`), so two bars never stack.
 */
export function showsBottomBar(groups: readonly NavGroup[], pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  return groups.some((group) =>
    group.items.some((link) => (link.subItems ? link.subItems.some((sub) => sub.href === path) : link.href === path && !link.hideBar))
  );
}

export interface ActiveNav {
  activeKey: string;
  activeSubKey?: string;
  /** The page draws its own top bar. */
  framed: boolean;
  groupLabel?: string;
  label?: string;
}

const under = (pathname: string, prefix: string): boolean => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Paths whose pages always draw their own top bar, even when no row matches them (screens reached from a row, phone-first task routes). */
const SELF_FRAMED_PREFIXES: readonly string[] = ['/app/inventory', '/app/branch', '/app/workforce/my-file', '/app/workforce/attendance'];

/** Which row (and sub-link) the current path lights: the longest matching prefix wins, so `/app/director/analytics` beats `/app/director`. */
export function activeFor(groups: readonly NavGroup[], pathname: string): ActiveNav {
  let best: { length: number; link: NavLink; sub?: NavLinkSub; group: NavGroup } | null = null;
  const consider = (prefixes: readonly string[], link: NavLink, group: NavGroup, sub?: NavLinkSub): void => {
    for (const prefix of prefixes) {
      if (!under(pathname, prefix)) continue;
      // On a tie the sub-link wins over its parent, so `/app/inventory/stock` lights "Overview".
      if (!best || prefix.length > best.length || (sub && prefix.length === best.length)) best = { length: prefix.length, link, sub, group };
    }
  };
  for (const group of groups) {
    for (const link of group.items) {
      if (!link.subItems) consider([link.href, ...link.match], link, group);
      else {
        consider(link.match, link, group);
        for (const sub of link.subItems) consider([sub.href, ...sub.match], link, group, sub);
      }
    }
  }
  const hit = best as { link: NavLink; sub?: NavLinkSub; group: NavGroup } | null;
  if (!hit) return { activeKey: '', framed: SELF_FRAMED_PREFIXES.some((p) => under(pathname, p)) };
  return {
    activeKey: hit.link.key,
    activeSubKey: hit.sub?.key,
    framed: hit.sub?.framed ?? hit.link.framed,
    groupLabel: hit.group.label,
    label: hit.sub?.label ?? hit.link.label,
  };
}

/** True when the role has any Central Store row, so the shell asks the server for that role's capabilities only when it needs them. */
export const hasHubRows = (role: AppRole | null | undefined): boolean => Boolean(role) && NAV_ROWS.some((row) => row.hub && role !== null && role !== undefined && row.roles.includes(role));

/** Print documents are bare pages: no sidebar, no top bar. */
export const isBareRoute = (pathname: string): boolean => /-print(\/|$)/.test(pathname) || /^\/app\/workforce\/schedule\/rota\/print(\/|$)/.test(pathname) || /^\/app\/workforce\/timesheets\/report(\/|$)/.test(pathname);

/**
 * Roles that use the one shell at every width: the sidebar on a desktop, a top bar with a menu drawer on a phone (and the floor-staff
 * bottom bar). The floor staff (waiter, chef, barista, steward, housekeeping) are here too, department or not: the department gate was
 * only for Block One.
 */
const SHELL_ROLES: readonly AppRole[] = [MANAGER, DIRECTOR, SYSTEM_ADMIN, ACCOUNTANT, HR_MANAGER, STORE_MANAGER, STORE_ATTENDANT, WAITER, CHEF, BARISTA, STEWARD, HOUSEKEEPING];
const DESKTOP_PREVIEW_ROLES: readonly AppRole[] = [WAITER, CHEF, BARISTA];

/**
 * Every human role uses the shell, and a department head or an active department member does whatever their base role (Paper
 * "Phone menus by role": no bottom tabs). Only the display-only roles are left out.
 */
export const usesAppShell = (role: AppRole | null | undefined, isDepartmentHead = false, isDepartmentMember = false): boolean =>
  Boolean(role) && (SHELL_ROLES.includes(role as AppRole) || isDepartmentHead || isDepartmentMember);

/** The roles whose department membership the layout has to look up before it can pick a frame (heads carry a marker on the token). */
export const FLOOR_ROLES: readonly AppRole[] = [WAITER, CHEF, BARISTA, STEWARD, HOUSEKEEPING];

/** The sidebar shows for these roles, and for the floor staff only in the desktop preview (a dev flag), next to their bottom tabs. */
export function usesDesktopShell(role: AppRole | null | undefined, desktopPreview: boolean, isDepartmentHead = false, isDepartmentMember = false): boolean {
  if (!role) return false;
  return usesAppShell(role, isDepartmentHead, isDepartmentMember) || (desktopPreview && DESKTOP_PREVIEW_ROLES.includes(role));
}
