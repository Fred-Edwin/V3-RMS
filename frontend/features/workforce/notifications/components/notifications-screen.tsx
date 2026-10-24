'use client';

import * as React from 'react';

import { PhoneSectionBar } from '@/components/app/shell/phone/phone-section-bar';
import { Topbar } from '@/components/app/shell/topbar';

import { useWorkforceNavDrawer } from '../../_shared';
import { unreadLine } from '../lib/notification-words';
import { useUnreadStore } from '../store/unread-store';
import { NotificationList } from './notification-list';

/**
 * Notifications as a page, `/app/workforce/notifications` (Paper 13.2): what the bell and "See all notifications" open on a phone. On a
 * desktop screen they open the drawer instead, so this page is reached there only by a typed link or a push, and it shows the same list
 * in the shell's usual frame. There is no Inbox in Workforce.
 */
export function NotificationsScreen() {
  const unread = useUnreadStore((s) => s.unread);
  const { open: openMenu } = useWorkforceNavDrawer();
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ root: 'Workforce', section: 'Overview', sectionHref: '/app/workforce', screen: 'Notifications' }} hideSearch className="hidden lg:flex" />
      <PhoneSectionBar title="Notifications" kicker={unreadLine(unread).toUpperCase()} unread={unread} bellHref="/app/workforce/notifications" hideBell onMenu={openMenu} className="lg:hidden" />
      <main aria-label="Notifications" className="flex min-h-0 flex-1 flex-col bg-wds-canvas">
        <div className="mx-auto flex min-h-0 w-full max-w-[560px] flex-1 flex-col lg:border-x lg:border-wds-border lg:bg-wds-surface">
          <NotificationList variant="page" />
        </div>
      </main>
    </div>
  );
}
