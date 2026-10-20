'use client';

import { useEffect, useRef } from 'react';

import { connectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';

/** The two nudges the server sends to a person's room; they carry no payload (the screen asks again). */
export type WorkforceNudge = 'workforce:needs-you' | 'workforce:notifications';

interface NudgeSocket {
  on: (event: WorkforceNudge, listener: () => void) => unknown;
  off: (event: WorkforceNudge, listener: () => void) => unknown;
}

/** Nudges that arrive together refetch once. */
const MERGE_MS = 250;
/** The worker process cannot reach browser sockets, so a visible tab also asks every minute (decisions-6a-backend #16). */
const POLL_MS = 60_000;

/**
 * Calls `onNudge` when something may have changed for this person: the socket nudge, the tab coming back to the foreground, and a
 * minute timer while the tab is visible. `onNudge` may change between renders without resubscribing. `enabled` false subscribes to nothing.
 * The first fetch is the caller's own (an effect on mount); this only keeps it fresh.
 */
export function useWorkforceNudge(events: readonly WorkforceNudge[], onNudge: () => void, enabled = true): void {
  const accessToken = useAuthStore((s) => s.accessToken);
  const latest = useRef(onNudge);
  useEffect(() => {
    latest.current = onNudge;
  });
  // The event list is a constant at every call site; joining it keeps the effect from resubscribing on a new array.
  const eventKey = events.join('|');

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
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') fire();
    }, POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
    const socket = connectSocket(accessToken) as unknown as NudgeSocket;
    const names = eventKey.split('|') as WorkforceNudge[];
    for (const name of names) socket.on(name, fire);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      for (const name of names) socket.off(name, fire);
    };
  }, [enabled, accessToken, eventKey]);
}
