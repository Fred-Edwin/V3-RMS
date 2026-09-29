'use client';

import * as React from 'react';

import { SidebarNav, type SidebarNavGroup } from '@/components/app/shell/sidebar-nav';
import { Topbar, type TopbarBreadcrumb } from '@/components/app/shell/topbar';
import type { SearchInputProps } from '@/components/ui2/search-input';
import { roleLabel } from '@/components/app/shell/role-label';
import { BranchIcon, DeliveriesIcon, DayIcon, WasteIcon } from './nav-icons';
import { CatalogIcon as RequisitionsIcon } from '@/components/app/shell/nav-icons';
import { useAuthStore } from '@/store/authStore';
import { performLogout } from '@/lib/logout';

const WENDO_LOGO_SRC = '/images/wendo-logo.jpg';

/**
 * Branch Manager workspace nav (decision #8, HANDOFF-session-b.md): Branch ·
 * Requisitions · Deliveries · Day · Waste. Requisitions (Milestone Four) and
 * Deliveries (Milestone Five, Session B) are live — Day/Waste remain
 * placeholder links (`href: '#'`), matching how `inventory-shell.tsx`
 * handles not-yet-built areas.
 */
const NAV_GROUPS: SidebarNavGroup[] = [
  {
    key: 'branch',
    label: 'BRANCH',
    items: [
      { key: 'branch', label: 'Branch', href: '#', icon: BranchIcon },
      { key: 'requisitions', label: 'Requisitions', href: '/app/branch/requisitions', icon: RequisitionsIcon },
      { key: 'deliveries', label: 'Deliveries', href: '/app/branch/deliveries', icon: DeliveriesIcon },
      { key: 'day', label: 'Day', href: '/app/branch/day', icon: DayIcon },
      { key: 'waste', label: 'Waste', href: '#', icon: WasteIcon },
    ],
  },
];

function useSidebarUser() {
  const user = useAuthStore((s) => s.user);
  const initials = React.useMemo(() => {
    if (!user?.name) return '—';
    const parts = user.name.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }, [user?.name]);
  return {
    name: user?.name ?? 'Branch Manager',
    role: roleLabel(user?.role),
    initials,
    // From the user's own org name, not hardcoded — decision requires this
    // to read the manager's actual branch, not a fixed "NYERI TOWN BRANCH".
    orgLabel: (user?.organizationName ?? 'BRANCH').toUpperCase(),
  };
}

export interface BranchDesktopShellProps {
  activeKey: string;
  breadcrumb: TopbarBreadcrumb;
  searchProps?: SearchInputProps;
  actions?: React.ReactNode;
  onNavigate?: (href: string) => void;
  children: React.ReactNode;
}

/** Sidebar (fixed 236px) + Topbar + content column — the Branch Manager workspace's persistent shell. */
export function BranchDesktopShell({ activeKey, breadcrumb, searchProps, actions, onNavigate, children }: BranchDesktopShellProps) {
  const { orgLabel, ...user } = useSidebarUser();

  return (
    <div className="flex h-screen min-h-0 w-full bg-wds-canvas">
      <SidebarNav
        groups={NAV_GROUPS}
        activeKey={activeKey}
        user={user}
        orgLabel={orgLabel}
        logoSrc={WENDO_LOGO_SRC}
        onNavigate={onNavigate ? (item) => onNavigate(item.href) : undefined}
        onSignOut={performLogout}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={breadcrumb} searchProps={searchProps} actions={actions} className="shrink-0" />
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">{children}</div>
      </div>
    </div>
  );
}

/** Just the 236px sidebar rail, no Topbar/content column — what `(shell)/layout.tsx` mounts once. */
export function BranchSidebar({ activeKey }: { activeKey: string }) {
  const { orgLabel, ...user } = useSidebarUser();
  return (
    <SidebarNav
      groups={NAV_GROUPS}
      activeKey={activeKey}
      user={user}
      orgLabel={orgLabel}
      logoSrc={WENDO_LOGO_SRC}
      onSignOut={performLogout}
    />
  );
}

export interface BranchMobileNavDrawerProps {
  activeKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (href: string) => void;
}

/** Mobile nav drawer — reuses `InventoryMobileNavDrawer`'s exact treatment with this workspace's own nav groups. */
export function BranchMobileNavDrawer(props: BranchMobileNavDrawerProps) {
  const { orgLabel: _orgLabel, ...user } = useSidebarUser();
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-wds-scrim" onClick={() => props.onOpenChange(false)} />
      <div className="relative flex h-full w-[280px] max-w-[85vw] flex-col bg-wds-gradient-sidebar">
        <SidebarNav
          groups={NAV_GROUPS}
          activeKey={props.activeKey}
          user={user}
          orgLabel="BRANCH"
          logoSrc={WENDO_LOGO_SRC}
          onNavigate={(item) => {
            props.onOpenChange(false);
            props.onNavigate?.(item.href);
          }}
          onSignOut={performLogout}
          className="w-full"
        />
      </div>
    </div>
  );
}
