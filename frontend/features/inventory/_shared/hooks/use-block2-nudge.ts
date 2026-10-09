'use client';

import { useEffect, useRef } from 'react';

import { connectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';

/** The two events a Block 2 screen refetches on: the payload-free badges nudge and the per-record `dispatch:changed` (Amendment 1 row 16). */
const EVENTS = ['inventory:badges', 'dispatch:changed'] as const;

interface NudgeSocket {
  on: (event: string, listener: () => void) => unknown;
  off: (event: string, listener: () => void) => unknown;
}

/** Nudges that arrive together (one write can tell two rooms) refetch once. */
const MERGE_MS = 250;

/**
 * Calls `onNudge` when another person's change reaches this screen: the `inventory:badges` nudge, a `dispatch:changed` event, and
 * the tab coming back to the foreground (so a nudge missed while the tab slept never leaves a stale screen). `onNudge` may change
 * between renders without resubscribing. `enabled` false subscribes to nothing.
 */
export function useBlock2Nudge(onNudge: () => void, enabled = true): void {
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
    const socket = connectSocket(accessToken) as unknown as NudgeSocket;
    for (const event of EVENTS) socket.on(event, fire);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      for (const event of EVENTS) socket.off(event, fire);
    };
  }, [enabled, accessToken]);
}
