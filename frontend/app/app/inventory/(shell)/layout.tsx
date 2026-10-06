'use client';

import * as React from 'react';

import { ShellNavDrawer } from '@/components/app/shell/shell-nav-drawer';
import {
  MobileNavDrawerProvider,
  useMobileNavDrawer,
} from '@/features/inventory/_shared/hooks/use-mobile-nav-drawer';

/**
 * Central Store route group. The sidebar is the app shell's (`components/app/shell/app-shell.tsx`, built from the one navigation
 * table), so this layout no longer draws one; a Next.js layout stays mounted across navigations within its group, so the phone
 * drawer state below survives Catalog ⇄ Suppliers just as the sidebar does. What stays here: the phone nav drawer (opened from
 * `MobileHubHeader`'s hamburger).
 *
 * Restock Levels (`/app/inventory/restock-levels`) is a separate, mobile-first full-screen task route by design (a Department
 * Head lands on it directly, back chevron not sidebar nav) and intentionally sits outside this route group.
 */
function InventoryShellDrawer() {
  const { isOpen, close } = useMobileNavDrawer();
  return <ShellNavDrawer open={isOpen} onOpenChange={(open) => (open ? undefined : close())} />;
}

export default function InventoryShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileNavDrawerProvider>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      <InventoryShellDrawer />
    </MobileNavDrawerProvider>
  );
}
