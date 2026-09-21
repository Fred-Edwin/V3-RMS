'use client';

import * as React from 'react';

import { SidebarNav, SidebarRail, type SidebarNavGroup } from '@/components/app/shell/sidebar-nav';
import { Topbar, type TopbarBreadcrumb } from '@/components/app/shell/topbar';
import type { SearchInputProps } from '@/components/ui2/search-input';
import {
  CatalogIcon,
  DashboardIcon,
  DispatchIcon,
  PrepIcon,
  PurchasingIcon,
  ReceivingIcon,
  ReportsIcon,
  StockCountsIcon,
  SupplierApIcon,
  SuppliersIcon,
} from '@/components/app/shell/nav-icons';
import { useAuthStore } from '@/store/authStore';
import { performLogout } from '@/lib/logout';

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
const NAV_GROUPS: SidebarNavGroup[] = [
  {
    key: 'central-store',
    label: 'CENTRAL STORE',
    items: [
      { key: 'dashboard', label: 'Dashboard', href: '#', icon: DashboardIcon },
      { key: 'receiving', label: 'Receiving', href: '/app/inventory/receiving', icon: ReceivingIcon },
      { key: 'purchasing', label: 'Purchasing', href: '/app/inventory/purchasing', icon: PurchasingIcon },
      { key: 'prep', label: 'Prep', href: '/app/inventory/prep', icon: PrepIcon },
      { key: 'dispatch', label: 'Dispatch', href: '#', icon: DispatchIcon },
      { key: 'stock-counts', label: 'Stock & counts', href: '#', icon: StockCountsIcon },
    ],
  },
  {
    key: 'procurement',
    label: 'PROCUREMENT',
    items: [
      { key: 'suppliers', label: 'Suppliers', href: '/app/inventory/suppliers', icon: SuppliersIcon },
      { key: 'supplier-ap', label: 'Supplier AP', href: '#', icon: SupplierApIcon },
      { key: 'catalog', label: 'Catalog', href: '/app/inventory/catalog', icon: CatalogIcon },
      { key: 'reports', label: 'Reports', href: '#', icon: ReportsIcon },
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
    name: user?.name ?? 'Store Manager',
    role: user?.role === 'STORE_ATTENDANT' ? 'Store Attendant' : 'Store Manager',
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

  return (
    <div className="flex h-screen min-h-0 w-full bg-wds-canvas">
      <SidebarNav
        groups={NAV_GROUPS}
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
export function InventorySidebar({ activeKey }: { activeKey: string }) {
  const user = useSidebarUser();
  return (
    <SidebarNav
      groups={NAV_GROUPS}
      activeKey={activeKey}
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
  return (
    <SidebarRail
      groups={NAV_GROUPS}
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
 */
export function InventoryMobileNavDrawer({ activeKey, open, onOpenChange, onNavigate }: InventoryMobileNavDrawerProps) {
  const user = useSidebarUser();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-wds-scrim" onClick={() => onOpenChange(false)} />
      <div className="relative flex h-full w-[280px] max-w-[85vw] flex-col bg-wds-gradient-sidebar">
        <SidebarNav
          groups={NAV_GROUPS}
          activeKey={activeKey}
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
      </div>
    </div>
  );
}
