'use client';

import { useCallback, useEffect } from 'react';

import { useAuthStore } from '@/store/authStore';
import { useWorkforceNudge } from '../../_shared';
import { notificationReads } from '../services/notification-services';
import { useUnreadStore } from '../store/unread-store';

/**
 * Keeps the unread Workforce notification count fresh (the shell calls this once). It asks on mount, on the `workforce:notifications`
 * nudge, when the tab comes back and every minute while visible. A failed call keeps the last number. Returns the shared count.
 */
export function useWorkforceUnread(enabled: boolean): number {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const unread = useUnreadStore((s) => s.unread);
  const setUnread = useUnreadStore((s) => s.setUnread);

  const load = useCallback((): void => {
    notificationReads.unreadCount().then(
      (answer) => setUnread(answer.unread),
      () => {
        // Non-critical: the Inbox badge keeps the last number it had.
      }
    );
  }, [setUnread]);

  useEffect(() => {
    if (enabled && userId) load();
  }, [enabled, userId, load]);
  useWorkforceNudge(['workforce:notifications'], load, enabled && userId !== null);

  return enabled ? unread : 0;
}

/** The shared count without asking the server (the Inbox reads what the shell already fetched). */
export const useWorkforceUnreadCount = (): number => useUnreadStore((s) => s.unread);
