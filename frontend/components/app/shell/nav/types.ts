import type { Capability } from '@/features/inventory';
import type { AppRole } from '@/types/auth';
import type { NavIcon } from '../nav-icons';

/**
 * THE NAVIGATION TABLE, types. One list of rows, one sidebar for every desktop role (the sibling of the Central Store access table,
 * `backend/src/modules/inventory/_shared/central-store-access.ts`). Each row is a link: what it is called, which group it sits in,
 * its icon, where it goes, and who may see it. The rows live in `rows-*.ts` beside this file, one file per module; the engine that
 * turns them into a sidebar is `engine.ts`. `../nav-table.ts` is the door everything else imports from.
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
  // Workforce numbers (Segment 6a). They come from GET /workforce/needs-you/counts, the same rows the Needs you card lists, and are drawn
  // only for the roles whose row carries them.
  | 'workforce-timesheets'
  | 'workforce-leave'
  | 'workforce-conduct'
  | 'workforce-payroll'
  | 'workforce-security';

/** A badge that only some people may see: it is dropped (not just hidden) for anyone without the capability. */
export const BADGE_CAPABILITY: Partial<Record<NavBadge, Capability>> = { 'prep-needs-look': 'prep.read_flags', requisitions: 'requisitions.read', discrepancies: 'requisitions.read', 'branch-day-todo': 'branch_day.close' };

export interface Visibility {
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
  /** An old screen that a rebuilt one replaces where the new clock is on: shown only while `NavContext.attendanceOn` is not true (Leave, segment 4). */
  oldOnlyWhenSwitchOff?: boolean;
  /** Shows only when Payroll has a month for the company (`NavContext.payrollOn`), whichever site the person belongs to. */
  needsPayroll?: boolean;
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
  /** The small caption this sub-link starts under (Workforce: Staff, Time, Pay, Setup). Drawn once, above the first link that carries it. */
  section?: string;
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
  /** Payroll has a month for the company (a branch is on the new clock, or a month already exists). Absent means off. */
  payrollOn?: boolean;
}

export interface NavLinkSub {
  key: string;
  label: string;
  href: string;
  framed: boolean;
  match: readonly string[];
  badge?: NavBadge;
  section?: string;
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

export interface ActiveNav {
  activeKey: string;
  activeSubKey?: string;
  /** The page draws its own top bar. */
  framed: boolean;
  groupLabel?: string;
  label?: string;
}
