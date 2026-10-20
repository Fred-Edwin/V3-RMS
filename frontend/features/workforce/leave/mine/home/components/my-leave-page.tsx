'use client';

import { useMediaQuery } from '@/hooks/useMediaQuery';

import { MyLeaveDesktop } from '../../desktop/components/my-leave-desktop';
import { LeaveHome } from './leave-home';

/**
 * `/app/workforce/my-leave`: the phone Leave home below 1024 px, the desktop list-and-detail from there up (same shell at every width).
 * It waits for the real width before mounting either, so the wrong one never fetches for a frame.
 */
export function MyLeavePage() {
  const { matches, hydrated } = useMediaQuery('(min-width: 1024px)');
  if (!hydrated) return <div className="min-h-0 flex-1 bg-wds-canvas" aria-busy="true" />;
  return matches ? <MyLeaveDesktop /> : <LeaveHome />;
}
