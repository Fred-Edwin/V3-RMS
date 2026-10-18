'use client';

import * as React from 'react';

import { MobileTopbar } from '@/components/app/shell/mobile-topbar';
import { Topbar, type TopbarBreadcrumb } from '@/components/app/shell/topbar';
import type { SearchInputProps } from '@/components/ui2/search-input';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/authStore';

import { useWorkforceNavDrawer } from '../hooks/use-nav-drawer';
import { initialsOf } from '../lib/avatar';

/**
 * The frame every Workforce screen sits in: the shell's desktop top bar (breadcrumb on the left, the page's actions on the right) from
 * 1024 px, the shell's compact bar with the menu drawer below that, then one scrolling area on the canvas. The brown action is the
 * last one passed (rule 04: one brown button per screen). It holds no role: a screen passes only the actions the person may use.
 */
export function WorkforceFrame({
  breadcrumb,
  phoneTitle,
  actions,
  searchProps,
  label,
  className,
  children,
}: {
  breadcrumb: TopbarBreadcrumb;
  /** A search box in the top bar (Positions draws one). Left out, the bar has none. */
  searchProps?: SearchInputProps;
  /** Name of the screen in the compact bar. */
  phoneTitle: string;
  actions?: React.ReactNode;
  /** Accessible name of the main region. */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  const { open: openMenu } = useWorkforceNavDrawer();
  const org = (user?.organizationName ?? 'COMPANY').toUpperCase();
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={breadcrumb} hideSearch={!searchProps} searchProps={searchProps} actions={actions} className="hidden lg:flex" />
      <MobileTopbar title={phoneTitle} orgLabel={org} initials={initialsOf(user?.name ?? '')} onMenuClick={openMenu} className="lg:hidden" />
      <main aria-label={label} className={cn('min-h-0 flex-1 overflow-y-auto bg-wds-canvas', className)}>
        {children}
      </main>
    </div>
  );
}
