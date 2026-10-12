'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuthStore } from '@/store/authStore';
import { requisitionsApi } from '../_shared/services/requisitions-api';
import type { Badges } from '../_shared/types/requisitions-contract';
import { useBadgesNudge } from './use-badges-nudge';

/**
 * The sidebar's Requisitions counts (R2): what waits for this role. `enabled` false asks the server nothing. A change elsewhere
 * (a head sends, the store packs) arrives as the `inventory:badges` nudge; the tab regaining focus refetches too, so a missed
 * nudge never leaves a stale count. The reference of the callbacks is stable.
 */
export function useRequisitionBadges(enabled: boolean): Badges | null {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [badges, setBadges] = useState<Badges | null>(null);
  const on = enabled && Boolean(accessToken);

  const refetch = useCallback((): void => {
    requisitionsApi.badges().then(setBadges, () => {
      // Non-critical: the sidebar keeps the last count it had.
    });
  }, []);

  useEffect(() => {
    if (on) refetch();
  }, [on, refetch]);
  useBadgesNudge(refetch, on);

  return enabled ? badges : null;
}
