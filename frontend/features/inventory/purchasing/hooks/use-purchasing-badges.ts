'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuthStore } from '@/store/authStore';
import { useBlock2Nudge } from '../../_shared/hooks/use-block2-nudge';
import type { Badges } from '../types/attendant';
import { usePurchasing } from './use-purchasing';

/**
 * The sidebar's Purchasing counts for the Store Attendant (Paper 28I): Receiving, Restock list, My orders, and the bell's unread
 * notices. `enabled` false asks the server nothing. They refetch after any Purchasing write on this device, on the
 * `inventory:badges` nudge, and when the tab comes back to the foreground; a failed fetch keeps the last counts.
 */
export function usePurchasingBadges(enabled: boolean): Badges | null {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { service, data: version } = usePurchasing();
  const [badges, setBadges] = useState<Badges | null>(null);
  const on = enabled && Boolean(accessToken);

  const refetch = useCallback((): void => {
    service.getAttendantBadges().then(setBadges, () => {
      // Non-critical: the sidebar keeps the last counts it had.
    });
  }, [service]);

  useEffect(() => {
    if (on) refetch();
  }, [on, refetch, version]);
  useBlock2Nudge(refetch, on);

  return enabled ? badges : null;
}
