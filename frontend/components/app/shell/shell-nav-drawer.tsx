'use client';

import * as React from 'react';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui2/sheet';
import { performLogout } from '@/lib/logout';
import { SidebarNav } from './sidebar-nav';
import { useShellNav } from './use-shell-nav';

const WENDO_LOGO_SRC = '/images/wendo-logo.jpg';

export interface ShellNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Phone nav drawer, opened from the hamburger in `MobileHubHeader`. Paper draws no overlay drawer (its phone artboards only show
 * the icon rail), so this is the same sidebar, built from the same navigation table, as a slide-in menu on the screens that
 * have no room for a persistent rail. Built on `Sheet` (Radix Dialog) for focus trapping, Escape to close and focus restore.
 */
export function ShellNavDrawer({ open, onOpenChange }: ShellNavDrawerProps) {
  const { groups, active, user, orgLabel } = useShellNav();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[280px] max-w-[85vw] border-none bg-wds-gradient-sidebar p-0 shadow-wds-drawer sm:max-w-[85vw] [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarNav
          groups={groups}
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
