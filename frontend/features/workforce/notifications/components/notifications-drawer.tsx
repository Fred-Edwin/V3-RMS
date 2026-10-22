'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Sheet, SheetClose, SheetContent, SheetDescription } from '@/components/ui2/sheet';

import { FOCUS_RING, MOTION, onHover } from '../../_shared';
import { useNotificationsDrawer } from '../store/drawer-store';
import { NotificationList } from './notification-list';

/**
 * The desktop notifications (Paper 13.1): a 480 px drawer from the right over the page the person is on, opened by the bell and by
 * "See all notifications". Escape, the close button and a click outside close it; focus returns to what opened it. It is mounted once, in
 * the Workforce layout, and reads nothing while closed. Below 1024 px the same links open the full page instead.
 */
export function NotificationsDrawer() {
  const open = useNotificationsDrawer((s) => s.open);
  const setOpen = useNotificationsDrawer((s) => s.setOpen);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" hideClose overlayClassName="bg-[#171512]/40" className="w-[480px] max-w-full gap-0 border-l border-wds-border-strong p-0 sm:max-w-full">
        <SheetDescription className="sr-only">Your notifications, newest first. Search or filter them, and open one to go to its page.</SheetDescription>
        <NotificationList
          variant="drawer"
          active={open}
          onLeave={() => setOpen(false)}
          closeSlot={
            <SheetClose
              aria-label="Close notifications"
              className={cn('flex size-8 shrink-0 items-center justify-center border border-wds-border-strong bg-wds-surface text-wds-neutral-700', MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'))}
            >
              <X className="size-3.5" strokeWidth={2} aria-hidden />
            </SheetClose>
          }
        />
      </SheetContent>
    </Sheet>
  );
}
