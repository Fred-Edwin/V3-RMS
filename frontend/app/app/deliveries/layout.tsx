'use client';

import * as React from 'react';

import { ShellNavDrawer } from '@/components/app/shell/shell-nav-drawer';
import { MobileNavDrawerProvider, useMobileNavDrawer } from '@/features/inventory/_shared/hooks/use-mobile-nav-drawer';

/** The department's Deliveries screens: the sidebar is the app shell's; what stays here is the phone menu drawer. */
function DeliveriesDrawer() {
  const { isOpen, close } = useMobileNavDrawer();
  return <ShellNavDrawer open={isOpen} onOpenChange={(open) => (open ? undefined : close())} />;
}

export default function DeliveriesLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileNavDrawerProvider>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      <DeliveriesDrawer />
    </MobileNavDrawerProvider>
  );
}
