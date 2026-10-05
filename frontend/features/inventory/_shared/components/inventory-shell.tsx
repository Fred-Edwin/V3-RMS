'use client';

import * as React from 'react';

import { SidebarNav, SidebarRail, type SidebarNavGroup, type SidebarNavItem } from '@/components/app/shell/sidebar-nav';
import type { NavIcon } from '@/components/app/shell/nav-icons';
import { Topbar, type TopbarBreadcrumb } from '@/components/app/shell/topbar';
import type { SearchInputProps } from '@/components/ui2/search-input';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui2/sheet';
import {
  AuditLogIcon,
  CatalogIcon,
  DashboardIcon,
  DispatchIcon,
  PrepIcon,
  PurchasingIcon,
  ReceivingIcon,
  SettingsIcon,
  StockCountsIcon,
  SuppliersIcon,
} from '@/components/app/shell/nav-icons';
import { roleLabel } from '@/components/app/shell/role-label';
import { useAuthStore } from '@/store/authStore';
import type { AppRole } from '@/types/auth';
import { useEffectiveRole } from '../hooks/use-demo-view';
import { performLogout } from '@/lib/logout';
import { navGroupsFor, type NavIconKey } from '../lib/nav-groups';
import { usePermissions } from '../hooks/use-permissions';

const WENDO_LOGO_SRC = '/images/wendo-logo.jpg';

/**
 * Desktop shell (Sidebar + Topbar) shared by every Milestone One desktop
 * screen. Nav groups/items match the reference used across the component
 * build (Session-0 shell `18O-0` specimen and Milestone One's own sidebar,
 * e.g. `SFQ-0`) — "Catalog" and "Suppliers" are the two live entries under
 * PROCUREMENT; every other item is a placeholder link for not-yet-redone
 * areas so the nav reads complete rather than emptied out around this
 * milestone's two screens.
 */
const NAV_ICONS: Record<NavIconKey, NavIcon> = {
  dashboard: DashboardIcon,
  receiving: ReceivingIcon,
  purchasing: PurchasingIcon,
  prep: PrepIcon,
  dispatch: DispatchIcon,
  'stock-counts': StockCountsIcon,
  suppliers: SuppliersIcon,
  catalog: CatalogIcon,
  'audit-log': AuditLogIcon,
  settings: SettingsIcon,
};

/**
 * The sidebar groups for the signed-in person: their role and the server's permissions table decide what shows
 * (`navGroupsFor`, in `../lib/nav-groups.ts`), and this gives each item its icon. It waits for the permissions table, so nothing
 * flashes in and out.
 */
function useNavGroups(): SidebarNavGroup[] {
  const { role } = useEffectiveRole();
  const { can } = usePermissions();
  return React.useMemo(
    () =>
      navGroupsFor(role, can).map(
        (group): SidebarNavGroup => ({
          key: group.key,
          label: group.label,
          items: group.items.map((item): SidebarNavItem => ({ key: item.key, label: item.label, href: item.href, icon: NAV_ICONS[item.iconKey], subItems: item.subItems })),
        })
      ),
    [role, can]
  );
}

function useSidebarUser() {
  const user = useAuthStore((s) => s.user);
  const { role: effectiveRole } = useEffectiveRole();
  const initials = React.useMemo(() => {
    if (!user?.name) return '—';
    const parts = user.name.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }, [user?.name]);
  return {
    name: user?.name ?? 'Store Manager',
    role: roleLabel(effectiveRole as AppRole | undefined),
    initials,
  };
}

export interface InventoryDesktopShellProps {
  activeKey: string;
  breadcrumb: TopbarBreadcrumb;
  searchProps?: SearchInputProps;
  actions?: React.ReactNode;
  onNavigate?: (href: string) => void;
  children: React.ReactNode;
}

/**
 * Sidebar (fixed 236px) + Topbar + content column. Reference:
 * `SFQ-0`/`SX5-0`/`T52-0` desktop shell.
 *
 * Used by screens that don't sit under `app/app/inventory/(shell)/layout.tsx`
 * (e.g. permission-denied early returns before the real screen mounts).
 * Catalog and Suppliers no longer use this for their main render path — the
 * `(shell)` route group's layout now owns the persistent Sidebar so it
 * doesn't remount on every nav; those screens render `InventorySidebar` is
 * not needed there at all, just `Topbar` + content directly. See
 * `InventorySidebar` below for the piece the layout actually uses.
 */
export function InventoryDesktopShell({
  activeKey,
  breadcrumb,
  searchProps,
  actions,
  onNavigate,
  children,
}: InventoryDesktopShellProps) {
  const user = useSidebarUser();
  const groups = useNavGroups();

  return (
    <div className="flex h-screen min-h-0 w-full bg-wds-canvas">
      <SidebarNav
        groups={groups}
        activeKey={activeKey}
        user={user}
        orgLabel="HUB"
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

/** Just the 236px sidebar rail, no Topbar/content column — what `(shell)/layout.tsx` mounts once so it survives Catalog ⇄ Suppliers navigation. */
export function InventorySidebar({ activeKey, activeSubKey }: { activeKey: string; activeSubKey?: string }) {
  const user = useSidebarUser();
  const groups = useNavGroups();
  return (
    <SidebarNav
      groups={groups}
      activeKey={activeKey}
      activeSubKey={activeSubKey}
      user={user}
      orgLabel="HUB"
      logoSrc={WENDO_LOGO_SRC}
      onSignOut={performLogout}
    />
  );
}

export interface InventoryMobileRailProps {
  activeKey: string;
  onNavigate?: (href: string) => void;
}

/** Icon-only mobile rail — used only where a screen needs the persistent nav, not the full-screen tasks. */
export function InventoryMobileRail({ activeKey, onNavigate }: InventoryMobileRailProps) {
  const user = useSidebarUser();
  const groups = useNavGroups();
  return (
    <SidebarRail
      groups={groups}
      activeKey={activeKey}
      user={user}
      logoSrc={WENDO_LOGO_SRC}
      onNavigate={onNavigate ? (item) => onNavigate(item.href) : undefined}
      onSignOut={performLogout}
    />
  );
}

export interface InventoryMobileNavDrawerProps {
  activeKey: string;
  activeSubKey?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (href: string) => void;
}

/**
 * Mobile nav drawer — opened from `MobileHubHeader`'s hamburger button.
 * There's no Paper node for this (Paper's mobile artboards only draw the
 * persistent icon rail, never an overlay drawer), so it reuses the existing
 * `SidebarRail` groups/icons as a full-width slide-in menu — the same
 * content the rail exposes, just reachable on the full-screen mobile routes
 * that don't have room for a persistent 60px rail.
 *
 * Built on `Sheet` (Radix Dialog) rather than a hand-rolled overlay so it
 * gets focus trapping, Escape-to-close and focus restoration for free —
 * same primitive every other overlay in this build already uses.
 */
export function InventoryMobileNavDrawer({ activeKey, activeSubKey, open, onOpenChange, onNavigate }: InventoryMobileNavDrawerProps) {
  const user = useSidebarUser();
  const groups = useNavGroups();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[280px] max-w-[85vw] border-none bg-wds-gradient-sidebar p-0 shadow-wds-drawer sm:max-w-[85vw] [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarNav
          groups={groups}
          activeKey={activeKey}
          activeSubKey={activeSubKey}
          user={user}
          orgLabel="HUB"
          logoSrc={WENDO_LOGO_SRC}
          onNavigate={(item) => {
            onOpenChange(false);
            onNavigate?.(item.href);
          }}
          onSignOut={performLogout}
          className="w-full"
        />
      </SheetContent>
    </Sheet>
  );
}
