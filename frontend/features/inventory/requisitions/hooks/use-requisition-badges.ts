'use client';

import { useCallback, useEffect, useState } from 'react';

import { connectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { requisitionsApi } from '../_shared/services/requisitions-api';
import type { Badges } from '../_shared/types/requisitions-contract';

/** The socket sends `inventory:badges` to the branch room whenever a count may have changed; it carries no payload, the screen refetches R2. */
interface BadgeSocket {
  on: (event: 'inventory:badges', listener: () => void) => unknown;
  off: (event: 'inventory:badges', listener: () => void) => unknown;
}

/**
 * The sidebar's Requisitions counts (R2): what waits for this role. `enabled` false asks the server nothing. A change elsewhere
 * (a head sends, the store packs) arrives as the `inventory:badges` nudge; the tab regaining focus refetches too, so a missed
 * nudge never leaves a stale count. The reference of the callbacks is stable.
 */
export function useRequisitionBadges(enabled: boolean): Badges | null {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [badges, setBadges] = useState<Badges | null>(null);

  const refetch = useCallback((): void => {
    requisitionsApi.badges().then(setBadges, () => {
      // Non-critical: the sidebar keeps the last count it had.
    });
  }, []);

  useEffect(() => {
    if (!enabled || !accessToken) return;
    refetch();
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    const socket = connectSocket(accessToken) as unknown as BadgeSocket;
    socket.on('inventory:badges', refetch);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      socket.off('inventory:badges', refetch);
    };
  }, [enabled, accessToken, refetch]);

  return enabled ? badges : null;
}
