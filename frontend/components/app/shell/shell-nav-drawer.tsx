'use client';

import * as React from 'react';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui2/sheet';
import { performLogout } from '@/lib/logout';
import { SidebarMenu } from './menu/sidebar-menu';
import { useShellNav } from './menu/use-shell-nav';

const WENDO_LOGO_SRC = '/images/wendo-logo.jpg';

export interface ShellNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Phone nav drawer, opened from the hamburger in a screen's phone header (Paper 2.x: 310 px wide on the design; 44 to 48 px rows). It is
 * the same menu, built from the same table, as a slide-in on the screens that have no room for the persistent sidebar. Built on `Sheet`
 * (Radix Dialog) for focus trapping, Escape to close and focus restore.
 */
export function ShellNavDrawer({ open, onOpenChange }: ShellNavDrawerProps) {
  const { menu, active, user, orgLabel } = useShellNav();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[310px] max-w-[88vw] border-none bg-wds-gradient-sidebar p-0 shadow-wds-drawer sm:max-w-[88vw] [&>button]:hidden">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarMenu
          menu={menu}
          activeKey={active.activeKey}
          activeSubKey={active.activeSubKey}
          user={user}
          orgLabel={orgLabel}
          logoSrc={WENDO_LOGO_SRC}
          onNavigate={() => onOpenChange(false)}
          onSignOut={performLogout}
          className="w-full"
        />
      </SheetContent>
    </Sheet>
  );
}
