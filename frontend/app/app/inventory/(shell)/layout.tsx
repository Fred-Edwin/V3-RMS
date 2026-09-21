'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { InventorySidebar } from '@/features/inventory/components/inventory-shell';
import { InventoryMobileNavDrawer } from '@/features/inventory/components/inventory-shell';
import {
  MobileNavDrawerProvider,
  useMobileNavDrawer,
} from '@/features/inventory/hooks/use-mobile-nav-drawer';

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
  return 'catalog';
}

function InventoryShellDrawer({ activeKey }: { activeKey: string }) {
  const { isOpen, close } = useMobileNavDrawer();
  return <InventoryMobileNavDrawer activeKey={activeKey} open={isOpen} onOpenChange={(open) => (open ? undefined : close())} />;
}

export default function InventoryShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeKey = activeKeyFromPathname(pathname);

  return (
    <MobileNavDrawerProvider>
      <div className="flex h-screen min-h-0 w-full bg-wds-canvas">
        <div className="hidden lg:flex">
          <InventorySidebar activeKey={activeKey} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
      <InventoryShellDrawer activeKey={activeKey} />
    </MobileNavDrawerProvider>
  );
}
