'use client';

import * as React from 'react';

import { ShellNavDrawer } from '@/components/app/shell/shell-nav-drawer';
import { MobileNavDrawerProvider, useMobileNavDrawer } from '@/features/inventory/_shared/hooks/use-mobile-nav-drawer';

/**
 * The Department Head's Requisitions screens. The sidebar is the app shell's (built from the one navigation table); what stays
 * here is the phone menu drawer, opened from the home header's menu icon.
 */
function RequisitionsDrawer() {
  const { isOpen, close } = useMobileNavDrawer();
  return <ShellNavDrawer open={isOpen} onOpenChange={(open) => (open ? undefined : close())} />;
}

export default function RequisitionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileNavDrawerProvider>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      <RequisitionsDrawer />
    </MobileNavDrawerProvider>
  );
}
