'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { toRemoteError, useWorkforceNudge, type RemoteError } from '../../_shared';
import { notificationReads, notificationWrites } from '../services/notification-services';
import { useUnreadStore } from '../store/unread-store';
import type { NotificationPage } from '../types/notification-types';

/**
 * One page of the person's Notifications, newest first. It reads again on the nudge, when the tab returns and every minute. Marking
 * a row read changes it on screen at once and tells the server; the shared unread number comes back from the server's answer.
 * A failed refresh keeps the last page (greyed by the caller) and reports the error.
 */
export function useNotificationPage(page: number, pageSize: number) {
  const setUnread = useUnreadStore((s) => s.setUnread);
  const [answer, setAnswer] = useState<{ key: string; data: NotificationPage | null; error: RemoteError | null } | null>(null);
  const key = `${page}:${pageSize}`;

  const load = useCallback((): void => {
    notificationReads.list(page, pageSize, false).then(
      (data) => {
        setAnswer({ key, data, error: null });
        setUnread(data.unread);
      },
      (err: unknown) => setAnswer((prev) => ({ key, data: prev?.key === key ? prev.data : null, error: toRemoteError(err) }))
    );
  }, [page, pageSize, key, setUnread]);

  useEffect(() => {
    load();
  }, [load]);
  useWorkforceNudge(['workforce:notifications'], load);

  const markRead = useCallback(
    async (ids: readonly string[]): Promise<void> => {
      setAnswer((prev) => (prev?.data ? { ...prev, data: { ...prev.data, items: prev.data.items.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)) } } : prev));
      try {
        setUnread((await notificationWrites.read(ids)).unread);
      } catch {
        load();
      }
    },
    [load, setUnread]
  );

  const markAllRead = useCallback(async (): Promise<void> => {
    setAnswer((prev) => (prev?.data ? { ...prev, data: { ...prev.data, items: prev.data.items.map((n) => ({ ...n, read: true })) } } : prev));
    try {
      setUnread((await notificationWrites.readAll()).unread);
    } catch {
      load();
    }
  }, [load, setUnread]);

  const mine = answer?.key === key ? answer : null;
  return useMemo(
    () => ({
      status: mine?.error ? ('error' as const) : mine?.data ? ('ready' as const) : ('loading' as const),
      data: mine?.data ?? null,
      error: mine?.error ?? null,
      reload: load,
      markRead,
      markAllRead,
    }),
    [mine, load, markRead, markAllRead]
  );
}
