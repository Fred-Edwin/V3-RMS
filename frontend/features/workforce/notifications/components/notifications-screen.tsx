'use client';

import * as React from 'react';

import { MobileTopbar } from '@/components/app/shell/mobile-topbar';
import { Topbar } from '@/components/app/shell/topbar';
import { useAuthStore } from '@/store/authStore';

import { initialsOf, useWorkforceNavDrawer } from '../../_shared';
import { NotificationsTab } from './notifications-tab';

/**
 * Notifications, `/app/workforce/notifications`: where Home's bell and "See all notifications" go. The person's own Workforce
 * notifications, newest first, paged (the Inbox tab's list, on its own page: there is no Inbox in Workforce).
 */
export function NotificationsScreen() {
  const user = useAuthStore((s) => s.user);
  const { open: openMenu } = useWorkforceNavDrawer();
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ root: 'Workforce', section: 'Overview', sectionHref: '/app/workforce', screen: 'Notifications' }} hideSearch className="hidden lg:flex" />
      <MobileTopbar title="Notifications" orgLabel={(user?.organizationName ?? 'COMPANY').toUpperCase()} initials={initialsOf(user?.name ?? '')} onMenuClick={openMenu} className="lg:hidden" />
      <main aria-label="Notifications" className="min-h-0 flex-1 overflow-y-auto bg-wds-canvas">
        <div className="mx-auto flex max-w-[860px] flex-col gap-3 px-4 py-6 md:px-8 md:py-7">
          <h1 className="m-0 font-wds-sans text-[28px] font-semibold leading-9 tracking-[-0.02em] text-wds-text-ink">Notifications</h1>
          <NotificationsTab />
        </div>
      </main>
    </div>
  );
}
