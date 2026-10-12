'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { useBranchDayBadge, useNeedsLookCount, usePermissions, usePurchasingBadges, useRequisitionBadges } from '@/features/inventory';
import { env } from '@/lib/env';
import { branchService } from '@/services/branchService';
import { useAuthStore } from '@/store/authStore';
import { useCommsStore } from '@/store/commsStore';
import type { AppRole } from '@/types/auth';
import { initialsOf as sharedInitialsOf } from '@/lib/initials';
import { activeFor, hasHubRows, navFor, quickLinksFor, showsBottomBar, type ActiveNav, type NavBadge } from './nav-table';
import type { NavIcon } from './nav-icons';
import { roleLabel } from './role-label';
import type { SidebarNavGroup, SidebarNavUser } from './sidebar-nav';

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
  groups: SidebarNavGroup[];
  active: ActiveNav;
  user: SidebarNavUser;
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
  const unreadInbox = useCommsStore((s) => s.unreadDmCount + s.unreadBroadcastCount + s.unreadNoticeCount);
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

  const tableGroups = React.useMemo(
    () =>
      navFor({
        role: role ?? undefined,
        isDepartmentHead,
        isDepartmentMember,
        can,
        creditAccounts: env.creditAccounts,
        branches,
      }),
    [role, isDepartmentHead, isDepartmentMember, can, branches]
  );

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
    };
    return (badge) => (badge && counts[badge] > 0 ? counts[badge] : undefined);
  }, [unreadInbox, needsLook, requisitionCount, discrepancyCount, requisitionBadges?.deliveries, dayTodo, purchasingBadges]);

  const groups = React.useMemo((): SidebarNavGroup[] => {
    return tableGroups.map((group) => ({
      key: group.key,
      label: group.label,
      items: group.items.map((link) => ({
        key: link.key,
        label: link.label,
        href: link.href,
        icon: link.icon,
        count: countOf(link.badge),
        subItems: link.subItems?.map(({ key, label, href, badge }) => ({ key, label, href, count: countOf(badge) })),
      })),
    }));
  }, [tableGroups, countOf]);

  // The phone bottom bar (floor staff): the table's quick links with the same counts, and whether this page shows it.
  const bar = React.useMemo(
    (): ShellBar => ({
      links: quickLinksFor(tableGroups).map((link) => ({ key: link.key, label: link.label, href: link.href, icon: link.icon, count: countOf(link.badge) })),
      visible: showsBottomBar(tableGroups, pathname),
    }),
    [tableGroups, countOf, pathname]
  );

  const active = React.useMemo(() => activeFor(tableGroups, pathname), [tableGroups, pathname]);

  const sidebarUser = React.useMemo(
    (): SidebarNavUser => ({ name: user?.name ?? roleLabel(role), role: roleLabel(role), initials: initialsOf(user?.name) }),
    [user?.name, role]
  );

  return { groups, active, user: sidebarUser, orgLabel: orgLabelFor(role, user?.organizationName), bar };
}
