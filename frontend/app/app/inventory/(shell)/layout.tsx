'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { InventorySidebar } from '@/features/inventory/_shared/components/inventory-shell';
import { InventoryMobileNavDrawer } from '@/features/inventory/_shared/components/inventory-shell';
import {
  MobileNavDrawerProvider,
  useMobileNavDrawer,
} from '@/features/inventory/_shared/hooks/use-mobile-nav-drawer';

/**
 * Persistent shell for Catalog + Suppliers — the two Inventory screens that
 * share one sidebar-driven nav. Restock Levels (`/app/inventory/restock-levels`)
 * is a separate, mobile-only full-screen task route by design (a Department
 * Head lands on it directly, back chevron not sidebar nav) and intentionally
 * sits outside this route group.
 *
 * Fixes the remount-on-navigate bug: before this layout existed, every
 * screen mounted its own copy of the sidebar (desktop) and nav drawer
 * (mobile), so clicking a sidebar link unmounted and remounted the entire
 * shell along with the content, producing a blank-page-then-spinner flash.
 * A Next.js layout stays mounted across navigations within its route group —
 * only `children` (the page) swaps — so the sidebar/drawer now persist.
 */
function activeKeyFromPathname(pathname: string): string {
  if (pathname.startsWith('/app/inventory/suppliers')) return 'suppliers';
  if (pathname.startsWith('/app/inventory/purchasing')) return 'purchasing';
  if (pathname.startsWith('/app/inventory/receiving')) return 'receiving';
  if (pathname.startsWith('/app/inventory/prep')) return 'prep';
  // Discrepancies live under Dispatch (resolved from the dispatch queue).
  if (pathname.startsWith('/app/inventory/dispatch') || pathname.startsWith('/app/inventory/discrepancies')) return 'dispatch';
  if (pathname.startsWith('/app/inventory/stock')) return 'stock-counts';
  if (pathname.startsWith('/app/inventory/settings')) return 'settings';
  return 'catalog';
}

/** Stock & counts sub-link for the rail (`1BI5-0`); undefined outside that area. */
function activeSubKeyFromPathname(pathname: string): string | undefined {
  if (!pathname.startsWith('/app/inventory/stock')) return undefined;
  if (pathname.startsWith('/app/inventory/stock/items')) return 'items';
  if (pathname.startsWith('/app/inventory/stock/ledger')) return 'ledger';
  if (pathname.startsWith('/app/inventory/stock/daily-count') || pathname.startsWith('/app/inventory/stock/counts')) return 'daily-count';
  if (pathname.startsWith('/app/inventory/stock/spot-count')) return 'spot-count';
  return 'overview';
}

function InventoryShellDrawer({ activeKey, activeSubKey }: { activeKey: string; activeSubKey?: string }) {
  const { isOpen, close } = useMobileNavDrawer();
  return (
    <InventoryMobileNavDrawer
      activeKey={activeKey}
      activeSubKey={activeSubKey}
      open={isOpen}
      onOpenChange={(open) => (open ? undefined : close())}
    />
  );
}

export default function InventoryShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeKey = activeKeyFromPathname(pathname);
  const activeSubKey = activeSubKeyFromPathname(pathname);

  return (
    <MobileNavDrawerProvider>
      <div className="flex h-screen min-h-0 w-full bg-wds-canvas">
        <div className="hidden lg:flex">
          <InventorySidebar activeKey={activeKey} activeSubKey={activeSubKey} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
      <InventoryShellDrawer activeKey={activeKey} activeSubKey={activeSubKey} />
    </MobileNavDrawerProvider>
  );
}
