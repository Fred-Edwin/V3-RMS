'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { usePermissions } from '@/features/inventory';
import { env } from '@/lib/env';
import { branchService } from '@/services/branchService';
import { useAuthStore } from '@/store/authStore';
import { useCommsStore } from '@/store/commsStore';
import type { AppRole } from '@/types/auth';
import { activeFor, hasHubRows, navFor, type ActiveNav, type NavBadge } from './nav-table';
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

const initialsOf = (name: string | undefined): string => {
  if (!name) return '—';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
};

export interface ShellNav {
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
  const { can } = usePermissions(hasHubRows(role));
  const branches = useBranches(role === 'DIRECTOR');
  const unreadInbox = useCommsStore((s) => s.unreadDmCount + s.unreadBroadcastCount + s.unreadNoticeCount);

  const tableGroups = React.useMemo(
    () =>
      navFor({
        role: role ?? undefined,
        isDepartmentHead,
        can,
        creditAccounts: env.creditAccounts,
        branches,
      }),
    [role, isDepartmentHead, can, branches]
  );

  // The unread count is the only thing added to the table's rows here.
  const groups = React.useMemo((): SidebarNavGroup[] => {
    // `prep-needs-look` is 0 until the Needs a look count is wired (Prep slice 4); a zero count draws nothing.
    const counts: Record<NavBadge, number> = { inbox: unreadInbox, 'prep-needs-look': 0 };
    const countOf = (badge: NavBadge | undefined): number | undefined => (badge && counts[badge] > 0 ? counts[badge] : undefined);
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
  }, [tableGroups, unreadInbox]);

  const active = React.useMemo(() => activeFor(tableGroups, pathname), [tableGroups, pathname]);

  const sidebarUser = React.useMemo(
    (): SidebarNavUser => ({ name: user?.name ?? roleLabel(role), role: roleLabel(role), initials: initialsOf(user?.name) }),
    [user?.name, role]
  );

  return { groups, active, user: sidebarUser, orgLabel: orgLabelFor(role, user?.organizationName) };
}
