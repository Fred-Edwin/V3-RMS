'use client';

import * as React from 'react';

import { ShellNavDrawer } from '@/components/app/shell/shell-nav-drawer';
import {
  MobileNavDrawerProvider,
  useMobileNavDrawer,
} from '@/features/branch/hooks/use-mobile-nav-drawer';

/**
 * Branch Manager workspace route group. The sidebar is the app shell's (built from the one navigation table), so this layout no
 * longer draws one. What stays here is the phone nav drawer, opened from the mobile header's hamburger; a Next.js layout stays
 * mounted across navigations within its group, so the drawer state survives them.
 */
function BranchShellDrawer() {
  const { isOpen, close } = useMobileNavDrawer();
  return <ShellNavDrawer open={isOpen} onOpenChange={(open) => (open ? undefined : close())} />;
}

export default function BranchShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileNavDrawerProvider>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      <BranchShellDrawer />
    </MobileNavDrawerProvider>
  );
}
