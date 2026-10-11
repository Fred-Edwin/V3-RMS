'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '../hooks/use-permissions';
import { useRequisitionBadges } from '../../requisitions/hooks/use-requisition-badges';

const SEEN_KEY = 'wendo:landed-on-deliveries';

/**
 * A department head or member whose delivery is on the way lands on Deliveries instead of the old floor dashboard (Paper chapter 14, B).
 * Once per sign-in: the flag stays in the tab, so going back to the dashboard later is never hijacked. Draws nothing.
 */
export function LandOnDeliveries() {
  const router = useRouter();
  const isHead = useAuthStore((s) => s.isDepartmentHead);
  const { isMember } = usePermissions(true);
  const enabled = isHead || isMember;
  const waiting = useRequisitionBadges(enabled)?.deliveries ?? 0;
  React.useEffect(() => {
    if (!enabled || waiting === 0) return;
    try {
      if (window.sessionStorage.getItem(SEEN_KEY) === '1') return;
      window.sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Storage blocked: land once per page load instead.
    }
    router.replace('/app/deliveries');
  }, [enabled, waiting, router]);
  return null;
}
