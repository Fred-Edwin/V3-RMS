'use client';

import { useEffect, useRef } from 'react';

import { connectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';

type Listener = () => void;
interface RecordSocket {
  on: (event: string, listener: Listener) => unknown;
  off: (event: string, listener: Listener) => unknown;
}

const MERGE_MS = 250;
const EVENTS = ['inventory:badges', 'dispatch:changed', 'discrepancy:changed'] as const;

/**
 * Calls `onNudge` when another person's change reaches this screen: the per-record `dispatch:changed` and `discrepancy:changed`
 * events (Amendment 1 row 16), the `inventory:badges` nudge, and the tab coming back to the foreground. Nudges that arrive together
 * refetch once. `onNudge` may change between renders without resubscribing.
 */
export function useRecordNudge(onNudge: () => void, enabled = true): void {
  const accessToken = useAuthStore((s) => s.accessToken);
  const latest = useRef(onNudge);
  useEffect(() => {
    latest.current = onNudge;
  });

  useEffect(() => {
    if (!enabled || !accessToken) return;
    let timer: number | undefined;
    const fire: Listener = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => latest.current(), MERGE_MS);
    };
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') fire();
    };
    document.addEventListener('visibilitychange', onVisible);
    const socket = connectSocket(accessToken) as unknown as RecordSocket;
    for (const event of EVENTS) socket.on(event, fire);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      for (const event of EVENTS) socket.off(event, fire);
    };
  }, [enabled, accessToken]);
}
