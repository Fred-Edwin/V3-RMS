'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';
import { useNeedsLookStore } from '../store/needs-look-store';

/**
 * The number on the sidebar's Prep and Runs rows. `enabled` is "this person holds prep.read_flags": for anyone else nothing is
 * requested and the answer is 0. It refetches when the route changes and after a write (see `refreshNeedsLookCount`), never on a timer.
 * Selecting `refresh` from the store keeps this effect's dependencies stable (CLAUDE.md hook-stability rules).
 */
export function useNeedsLookCount(enabled: boolean): number {
  const pathname = usePathname();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const count = useNeedsLookStore((s) => s.count);
  const owner = useNeedsLookStore((s) => s.userId);
  const refresh = useNeedsLookStore((s) => s.refresh);

  React.useEffect(() => {
    if (enabled && userId && accessToken) void refresh(userId);
  }, [enabled, userId, accessToken, pathname, refresh]);

  return enabled && owner === userId ? count : 0;
}

/** Call after Mark reviewed (or anything else that changes the queue) so the badge catches up without a reload. */
export function refreshNeedsLookCount(): void {
  const userId = useAuthStore.getState().user?.id;
  if (userId) void useNeedsLookStore.getState().refresh(userId);
}
