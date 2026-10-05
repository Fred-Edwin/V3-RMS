'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { ShellNavDrawer } from '@/components/app/shell/shell-nav-drawer';
import { DemoBar } from '@/features/inventory/purchasing/components/demo-bar';
import {
  MobileNavDrawerProvider,
  useMobileNavDrawer,
} from '@/features/inventory/_shared/hooks/use-mobile-nav-drawer';

/**
 * Central Store route group. The sidebar is the app shell's (`components/app/shell/app-shell.tsx`, built from the one navigation
 * table), so this layout no longer draws one; a Next.js layout stays mounted across navigations within its group, so the phone
 * drawer state below survives Catalog ⇄ Suppliers just as the sidebar does. What stays here: the phone nav drawer (opened from
 * `MobileHubHeader`'s hamburger) and the demo bar.
 *
 * Restock Levels (`/app/inventory/restock-levels`) is a separate, mobile-first full-screen task route by design (a Department
 * Head lands on it directly, back chevron not sidebar nav) and intentionally sits outside this route group.
 */
function InventoryShellDrawer() {
  const { isOpen, close } = useMobileNavDrawer();
  return <ShellNavDrawer open={isOpen} onOpenChange={(open) => (open ? undefined : close())} />;
}

/** Purchasing, Receiving, Suppliers and the audit log all show the same mock demo data, so they share the demo bar. */
const DEMO_BAR_PREFIXES = ['/app/inventory/purchasing', '/app/inventory/receiving', '/app/inventory/suppliers', '/app/inventory/audit-log'];

export default function InventoryShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showDemoBar = DEMO_BAR_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  return (
    <MobileNavDrawerProvider>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      <InventoryShellDrawer />
      {/* Demo only (System Admin): role switcher and scenarios for the mock Purchasing and Receiving screens, and for the supplier
          page and audit log, which show the same demo data (orders, what we owe, statement, purchasing actions). */}
      {showDemoBar ? <DemoBar /> : null}
    </MobileNavDrawerProvider>
  );
}
