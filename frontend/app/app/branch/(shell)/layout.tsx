'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { BranchSidebar, BranchMobileNavDrawer } from '@/features/branch/components/branch-shell';
import {
  MobileNavDrawerProvider,
  useMobileNavDrawer,
} from '@/features/branch/hooks/use-mobile-nav-drawer';

/**
 * Persistent shell for the Branch Manager workspace — same remount-flash fix
 * as `app/app/inventory/(shell)/layout.tsx` (a Next.js layout stays mounted
 * across navigations within its route group, so the sidebar/drawer don't
 * remount on every nav).
 */
function activeKeyFromPathname(pathname: string): string {
  if (pathname.startsWith('/app/branch/requisitions')) return 'requisitions';
  if (pathname.startsWith('/app/branch/deliveries')) return 'deliveries';
  return 'branch';
}

function BranchShellDrawer({ activeKey }: { activeKey: string }) {
  const { isOpen, close } = useMobileNavDrawer();
  return <BranchMobileNavDrawer activeKey={activeKey} open={isOpen} onOpenChange={(open) => (open ? undefined : close())} />;
}

export default function BranchShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeKey = activeKeyFromPathname(pathname);

  return (
    <MobileNavDrawerProvider>
      <div className="flex h-screen min-h-0 w-full bg-wds-canvas">
        <div className="hidden lg:flex">
          <BranchSidebar activeKey={activeKey} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
      <BranchShellDrawer activeKey={activeKey} />
    </MobileNavDrawerProvider>
  );
}
