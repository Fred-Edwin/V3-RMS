'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { useBranchDayBadge, useNeedsLookCount, usePermissions, usePurchasingBadges, useRequisitionBadges } from '@/features/inventory';
import { useAttendanceOn } from '@/features/workforce/attendance/shell';
import { useNeedsYouMenuCounts } from '@/features/workforce/needs-you';
import { useWorkforceUnread } from '@/features/workforce/notifications';
import { usePayrollOn } from '@/features/workforce/payroll/shell';
import { env } from '@/lib/env';
import { branchService } from '@/services/branchService';
import { useAuthStore } from '@/store/authStore';
import { useCommsStore } from '@/store/commsStore';
import type { AppRole } from '@/types/auth';
import { initialsOf as sharedInitialsOf } from '@/lib/initials';
import { activeFor, hasHubRows, menuFor, menuGroups, navFor, quickLinksFor, showsBottomBar, type ActiveNav, type NavBadge, type NavLink } from '../nav-table';
import type { NavIcon } from '../nav-icons';
import { roleLabel } from '../role-label';
import type { MenuItem, MenuNavModel, MenuUser } from './menu-types';

/** The Director's branches for the rows that expand (the hub is a supply facility, not a branch). Fetched only for a Director. */
function useBranches(enabled: boolean): Array<{ id: string; name: string }> {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [branches, setBranches] = React.useState<Array<{ id: string; name: string }>>([]);
  React.useEffect(() => {
    if (!enabled || !accessToken) return;
    let cancelled = false;
    branchService
      .listBranches(accessToken)
      .then((data) => {
        if (!cancelled) setBranches(data.filter((b) => b.isActive && !b.isHub).map((b) => ({ id: b.id, name: b.name })));
      })
      .catch(() => {
        // Non-critical: the sidebar still renders, without the branch links.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, accessToken]);
  return branches;
}

/** The label next to the wordmark: the branch for branch-level roles, the Central Store for its staff, the company for the rest. */
function orgLabelFor(role: AppRole | null, organizationName: string | null | undefined): string {
  switch (role) {
    case 'STORE_MANAGER':
    case 'STORE_ATTENDANT':
      return 'HUB';
    case 'MANAGER':
    case 'WAITER':
    case 'CHEF':
    case 'BARISTA':
    case 'STEWARD':
    case 'HOUSEKEEPING':
      return (organizationName ?? 'BRANCH').toUpperCase();
    default:
      return 'COMPANY';
  }
}

const initialsOf = (name: string | undefined): string => sharedInitialsOf(name) || '—';

/** The roles whose Workforce access table holds `needs_you.read` (API_CONTRACT §43). The server decides; this only avoids asking for nothing. */
const NEEDS_YOU_ROLES: readonly AppRole[] = ['MANAGER', 'STORE_MANAGER', 'HR_MANAGER', 'ACCOUNTANT', 'DIRECTOR', 'SYSTEM_ADMIN'];

export interface ShellBarLink {
  key: string;
  label: string;
  href: string;
  icon: NavIcon;
  count?: number;
}

/** The phone bottom bar: its links (empty for a role with none) and whether the current page shows it. */
export interface ShellBar {
  links: ShellBarLink[];
  visible: boolean;
}

export interface ShellNav {
  bar: ShellBar;
  menu: MenuNavModel;
  active: ActiveNav;
  user: MenuUser;
  orgLabel: string;
}

/**
 * The sidebar for the signed-in person, built from the one navigation table: their role, the department-head marker, the Central
 * Store capabilities from the server, and the unread count. Everything about WHO sees WHAT lives in `nav-table.ts`; this only
 * gathers the facts and gives the table's rows their counts.
 */
export function useShellNav(): ShellNav {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const isDepartmentHead = useAuthStore((s) => s.isDepartmentHead);
  // A floor member also asks (the call is open to any signed-in person) so the shell knows whether they belong to a department.
  const { can, isMember: isDepartmentMember } = usePermissions(hasHubRows(role) || isDepartmentHead || role === 'WAITER' || role === 'CHEF' || role === 'BARISTA' || role === 'STEWARD' || role === 'HOUSEKEEPING');
  const branches = useBranches(role === 'DIRECTOR');
  // Whether the new clock is on for this person's branch: the Schedule rows, the Today board and the floor staff's Home link wait for it.
  const attendanceOn = useAttendanceOn(role, isDepartmentHead);
  // Whether Payroll has a month for the company: the Payroll row waits for it (asked of Payroll itself, so it holds for the Accountant too).
  const payrollOn = usePayrollOn(role);
  // The Inbox badge adds the unread Workforce notifications to the old message counts (Segment 6a).
  const unreadNotifications = useWorkforceUnread(role !== null);
  const unreadInbox = useCommsStore((s) => s.unreadDmCount + s.unreadBroadcastCount + s.unreadNoticeCount) + unreadNotifications;
  // Only someone who may read flags is told how many runs need a look (the hook asks the server nothing otherwise).
  const needsLook = useNeedsLookCount(hasHubRows(role) && can('prep.read_flags'));
  // What waits for this role on Requisitions (R2), refetched on the `inventory:badges` nudge.
  // The Branch Manager's own branch asks too (a delivery waiting joins the Queue count; open shortages badge Discrepancies); the server decides what they may see.
  // A department head or member asks too, for the Deliveries badge (deliveries waiting for their department).
  const requisitionBadges = useRequisitionBadges((hasHubRows(role) && can('requisitions.read')) || role === 'MANAGER' || isDepartmentHead || isDepartmentMember);
  const requisitionCount = (requisitionBadges?.requisitions ?? 0) + (role === 'MANAGER' ? requisitionBadges?.deliveries ?? 0 : 0);
  const discrepancyCount = requisitionBadges?.discrepancies ?? 0;
  // The Store Attendant's Purchasing counts (Receiving, Restock list, My orders): only someone who raises but cannot approve orders.
  const purchasingBadges = usePurchasingBadges(hasHubRows(role) && can('orders.request') && !can('orders.approve'));
  // What blocks the close today, beside Today in the Branch Manager's Day group (only someone who closes the day is told).
  const dayTodo = useBranchDayBadge(role === 'MANAGER' && can('branch_day.close'));
  // The Workforce menu numbers: only the roles that hold `needs_you.read` ask (the server answers 404 to anyone else).
  const { badges: workforceBadges, overdue: workforceOverdue } = useNeedsYouMenuCounts(role !== null && NEEDS_YOU_ROLES.includes(role));

  const navContext = React.useMemo(
    () => ({
      role: role ?? undefined,
      isDepartmentHead,
      isDepartmentMember,
      can,
      creditAccounts: env.creditAccounts,
      branches,
      attendanceOn,
      payrollOn,
    }),
    [role, isDepartmentHead, isDepartmentMember, can, branches, attendanceOn, payrollOn]
  );
  // The old flat groups still drive the phone bottom bar (floor staff); the sidebar and the drawer draw the three-level menu.
  const tableGroups = React.useMemo(() => navFor(navContext), [navContext]);
  const menuModel = React.useMemo(() => menuFor(navContext), [navContext]);

  // The counts are the only thing added to the table's rows here. A zero count draws nothing, so a role without prep.read_flags
  // (count 0) simply has no badge.
  const countOf = React.useMemo((): ((badge: NavBadge | undefined) => number | undefined) => {
    const counts: Record<NavBadge, number> = {
      inbox: unreadInbox,
      'prep-needs-look': needsLook,
      requisitions: requisitionCount,
      discrepancies: discrepancyCount,
      deliveries: requisitionBadges?.deliveries ?? 0,
      'branch-day-todo': dayTodo,
      'purchasing-receiving': purchasingBadges?.receiving ?? 0,
      'purchasing-restock': purchasingBadges?.restock ?? 0,
      'purchasing-my-orders': purchasingBadges?.myOrders ?? 0,
      // Workforce: the Needs you counts, from the same rows the card lists (Segment 6a). Zero draws nothing.
      'workforce-timesheets': workforceBadges['workforce-timesheets'],
      'workforce-leave': workforceBadges['workforce-leave'],
      'workforce-conduct': workforceBadges['workforce-conduct'],
      'workforce-payroll': workforceBadges['workforce-payroll'],
      'workforce-security': workforceBadges['workforce-security'],
    };
    return (badge) => (badge && counts[badge] > 0 ? counts[badge] : undefined);
  }, [unreadInbox, needsLook, requisitionCount, discrepancyCount, requisitionBadges?.deliveries, dayTodo, purchasingBadges, workforceBadges]);

  // A link is urgent (the red-brown dot) when the badge it carries holds something overdue. Only the Workforce badges know that.
  const urgentOf = React.useMemo((): ((badge: NavBadge | undefined) => boolean) => {
    const overdue: Partial<Record<NavBadge, number>> = {
      'workforce-timesheets': workforceOverdue['workforce-timesheets'],
      'workforce-leave': workforceOverdue['workforce-leave'],
      'workforce-conduct': workforceOverdue['workforce-conduct'],
      'workforce-payroll': workforceOverdue['workforce-payroll'],
      'workforce-security': workforceOverdue['workforce-security'],
    };
    return (badge) => (badge ? (overdue[badge] ?? 0) > 0 : false);
  }, [workforceOverdue]);

  const menu = React.useMemo((): MenuNavModel => {
    const item = (link: NavLink): MenuItem => ({
      key: link.key,
      label: link.label,
      href: link.href,
      icon: link.icon,
      count: countOf(link.badge),
      urgent: urgentOf(link.badge),
      subItems: link.subItems?.map((s) => ({ key: s.key, label: s.label, href: s.href, count: countOf(s.badge), urgent: urgentOf(s.badge), section: s.section })),
    });
    return { top: menuModel.top.map(item), features: menuModel.features.map(item), account: menuModel.account.map(item) };
  }, [menuModel, countOf, urgentOf]);

  // The phone bottom bar (floor staff): the table's quick links with the same counts, and whether this page shows it.
  const bar = React.useMemo(
    (): ShellBar => ({
      links: quickLinksFor(tableGroups).map((link) => ({ key: link.key, label: link.label, href: link.href, icon: link.icon, count: countOf(link.badge) })),
      visible: showsBottomBar(tableGroups, pathname),
    }),
    [tableGroups, countOf, pathname]
  );

  // Which link lights, and whether the page draws its own top bar: the menu's links, then the personal items (My payslips has no sidebar row).
  const active = React.useMemo(() => activeFor(menuGroups(menuModel), pathname), [menuModel, pathname]);

  const sidebarUser = React.useMemo(
    (): MenuUser => ({ name: user?.name ?? roleLabel(role), role: roleLabel(role), initials: initialsOf(user?.name) }),
    [user?.name, role]
  );

  return { menu, active, user: sidebarUser, orgLabel: orgLabelFor(role, user?.organizationName), bar };
}
