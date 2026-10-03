'use client';

import * as React from 'react';

import {
  SidebarNav,
  SidebarRail,
  type SidebarNavGroup,
  type SidebarNavSubItem,
} from '@/components/app/shell/sidebar-nav';
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
  ReportsIcon,
  SettingsIcon,
  StockCountsIcon,
  SuppliersIcon,
} from '@/components/app/shell/nav-icons';
import { roleLabel } from '@/components/app/shell/role-label';
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
/**
 * Stock & counts sub-pages (Milestone Six, `1BI5-0`). "Daily count" is the
 * Store Manager's verify screen; the Store Attendant's own link goes to the
 * blind count sheet (see `navGroupsForRole`).
 */
const STOCK_SUB_ITEMS: SidebarNavSubItem[] = [
  { key: 'overview', label: 'Overview', href: '/app/inventory/stock' },
  { key: 'items', label: 'All items', href: '/app/inventory/stock/items' },
  { key: 'daily-count', label: 'Daily count', href: '/app/inventory/stock/counts' },
  { key: 'spot-count', label: 'Spot count', href: '/app/inventory/stock/spot-count' },
  { key: 'ledger', label: 'Stock ledger', href: '/app/inventory/stock/ledger' },
];

/** Blind count: the attendant has no All items / Stock ledger (both 403), and no spot count. */
const ATTENDANT_STOCK_SUB_KEYS = new Set(['overview', 'daily-count']);

const NAV_GROUPS: SidebarNavGroup[] = [
  {
    key: 'central-store',
    label: 'CENTRAL STORE',
    items: [
      { key: 'dashboard', label: 'Dashboard', href: '#', icon: DashboardIcon },
      { key: 'receiving', label: 'Receiving', href: '/app/inventory/receiving', icon: ReceivingIcon },
      { key: 'purchasing', label: 'Purchasing', href: '/app/inventory/purchasing', icon: PurchasingIcon },
      { key: 'prep', label: 'Prep', href: '/app/inventory/prep', icon: PrepIcon },
      { key: 'dispatch', label: 'Dispatch', href: '/app/inventory/dispatch', icon: DispatchIcon },
      {
        key: 'stock-counts',
        label: 'Stock & counts',
        href: '/app/inventory/stock',
        icon: StockCountsIcon,
        subItems: STOCK_SUB_ITEMS,
      },
    ],
  },
  {
    key: 'procurement',
    label: 'PROCUREMENT',
    items: [
      { key: 'suppliers', label: 'Suppliers', href: '/app/inventory/suppliers', icon: SuppliersIcon },
      { key: 'catalog', label: 'Catalog', href: '/app/inventory/catalog', icon: CatalogIcon },
      { key: 'reports', label: 'Reports', href: '#', icon: ReportsIcon },
      // Store Manager, Accountant and Director read it; `navGroupsForRole` drops it for the Store Attendant.
      { key: 'audit-log', label: 'Audit log', href: '/app/inventory/audit-log', icon: AuditLogIcon },
      // STORE_MANAGER only — `navGroupsForRole` drops it for every other role.
      { key: 'settings', label: 'Settings', href: '/app/inventory/settings', icon: SettingsIcon },
    ],
  },
];

/** Settings (Team + My PIN) is the Store Manager's alone — hidden from every other role that reaches this shell. */
function withoutSettings(groups: SidebarNavGroup[]): SidebarNavGroup[] {
  return groups.map((group) => ({ ...group, items: group.items.filter((item) => item.key !== 'settings') }));
}

/**
 * STORE_ATTENDANT is 403'd outright (not just filtered server-side) on
 * Purchasing and Suppliers — see `receiving-routes.ts` /
 * `inventory-routes.ts` comments ("STORE_ATTENDANT has zero access — not
 * even read"). The sidebar must hide these links for that role so it never
 * offers a route that always fails.
 */
function navGroupsForRole(role: string | undefined): SidebarNavGroup[] {
  if (role !== 'STORE_MANAGER' && role !== 'STORE_ATTENDANT') return withoutSettings(NAV_GROUPS);
  if (role === 'STORE_MANAGER') return NAV_GROUPS;
  return NAV_GROUPS.map((group) => {
    if (group.key !== 'central-store' && group.key !== 'procurement') return group;
    return {
      ...group,
      items: group.items
        .filter((item) => item.key !== 'purchasing' && item.key !== 'suppliers' && item.key !== 'settings' && item.key !== 'audit-log')
        .map((item) =>
          item.subItems
            ? {
                ...item,
                subItems: item.subItems
                  .filter((sub) => ATTENDANT_STOCK_SUB_KEYS.has(sub.key))
                  .map((sub) => (sub.key === 'daily-count' ? { ...sub, href: '/app/inventory/stock/daily-count' } : sub)),
              }
            : item,
        ),
    };
  });
}

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
    role: roleLabel(user?.role),
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
  const authRole = useAuthStore((s) => s.user?.role);

  return (
    <div className="flex h-screen min-h-0 w-full bg-wds-canvas">
      <SidebarNav
        groups={navGroupsForRole(authRole)}
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
  const authRole = useAuthStore((s) => s.user?.role);
  return (
    <SidebarNav
      groups={navGroupsForRole(authRole)}
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
  const authRole = useAuthStore((s) => s.user?.role);
  return (
    <SidebarRail
      groups={navGroupsForRole(authRole)}
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
  const authRole = useAuthStore((s) => s.user?.role);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[280px] max-w-[85vw] border-none bg-wds-gradient-sidebar p-0 shadow-wds-drawer sm:max-w-[85vw] [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarNav
          groups={navGroupsForRole(authRole)}
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
