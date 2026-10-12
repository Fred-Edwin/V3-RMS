'use client';

import { useEffect, useRef } from 'react';

import { connectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';

/** The socket sends `inventory:badges` to the branch room whenever something a screen shows may have changed; it carries no payload. */
interface BadgeSocket {
  on: (event: 'inventory:badges', listener: () => void) => unknown;
  off: (event: 'inventory:badges', listener: () => void) => unknown;
}

/** Nudges that arrive together (one write can tell two rooms) refetch once. */
const MERGE_MS = 250;

/**
 * Calls `onNudge` when another person's change reaches this screen: the `inventory:badges` socket nudge, and the tab coming back
 * to the foreground (so a nudge missed while the tab slept never leaves a stale screen). `onNudge` may change between renders
 * without resubscribing. `enabled` false subscribes to nothing.
 */
export function useBadgesNudge(onNudge: () => void, enabled = true): void {
  const accessToken = useAuthStore((s) => s.accessToken);
  const latest = useRef(onNudge);
  useEffect(() => {
    latest.current = onNudge;
  });

  useEffect(() => {
    if (!enabled || !accessToken) return;
    let timer: number | undefined;
    const fire = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => latest.current(), MERGE_MS);
    };
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') fire();
    };
    document.addEventListener('visibilitychange', onVisible);
    const socket = connectSocket(accessToken) as unknown as BadgeSocket;
    socket.on('inventory:badges', fire);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      socket.off('inventory:badges', fire);
    };
  }, [enabled, accessToken]);
}
