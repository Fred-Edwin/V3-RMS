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
  const role = useAuthStore((s) => s.role);
  const badges = useRequisitionBadges(enabled);
  const loaded = badges !== null;
  const waiting = badges?.deliveries ?? 0;
  // Barista and Kitchen heads and members start the sign-in on Day when no delivery is waiting (UX walk phase 3, finding 4).
  const landsOnDay = enabled && (role === 'BARISTA' || role === 'CHEF');
  React.useEffect(() => {
    if (!enabled || !loaded) return;
    if (waiting === 0 && !landsOnDay) return;
    try {
      if (window.sessionStorage.getItem(SEEN_KEY) === '1') return;
      window.sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Storage blocked: land once per page load instead.
    }
    router.replace(waiting > 0 ? '/app/deliveries' : '/app/day');
  }, [enabled, loaded, waiting, landsOnDay, router]);
  return null;
}
