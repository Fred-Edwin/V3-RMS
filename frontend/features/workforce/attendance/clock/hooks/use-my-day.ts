'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { attendanceReads } from '../../_shared/services/attendance-services';
import type { MyDay } from '../../_shared/types/attendance-types';

/**
 * "My day" (C1), shared by every part of the phone Home that needs it (the clock card, the shift pill, the week card, the notices).
 * One request serves them all; it is asked again every 30 seconds while any of them is on screen, whenever the page comes back to the
 * front, and after every tap. The server's clock decides every time on the card: `offsetMs` is how far the phone's clock is from it.
 */

export type MyDayState =
  | { status: 'loading'; day: null; offsetMs: 0 }
  | { status: 'ready'; day: MyDay; offsetMs: number }
  | { status: 'error'; day: MyDay | null; offsetMs: number };

const POLL_MS = 30_000;
const LOADING: MyDayState = { status: 'loading', day: null, offsetMs: 0 };

let state: MyDayState = LOADING;
let subscribers = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let inflight = false;
const listeners = new Set<() => void>();

const publish = (next: MyDayState): void => {
  state = next;
  listeners.forEach((l) => l());
};

export async function refreshMyDay(): Promise<void> {
  if (inflight) return;
  inflight = true;
  try {
    const day = await attendanceReads.me();
    publish({ status: 'ready', day, offsetMs: Date.parse(day.serverNow) - Date.now() });
  } catch {
    publish({ status: 'error', day: state.day, offsetMs: state.offsetMs });
  } finally {
    inflight = false;
  }
}

const onVisible = (): void => {
  if (document.visibilityState === 'visible') void refreshMyDay();
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  subscribers += 1;
  if (subscribers === 1) {
    void refreshMyDay();
    timer = setInterval(() => void refreshMyDay(), POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
  }
  return () => {
    listeners.delete(listener);
    subscribers -= 1;
    if (subscribers === 0) {
      if (timer) clearInterval(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onVisible);
      state = LOADING;
    }
  };
}

export function useMyDay(enabled = true): MyDayState & { reload: () => void } {
  const snapshot = useSyncExternalStore(
    useCallback((l: () => void) => (enabled ? subscribe(l) : () => undefined), [enabled]),
    () => state,
    () => LOADING
  );
  const reload = useCallback(() => void refreshMyDay(), []);
  return { ...snapshot, reload };
}

/** The server-corrected time now, ticking each second while `active`. */
export function useServerNow(offsetMs: number, active: boolean): number {
  const tick = useSyncExternalStore(
    useCallback(
      (l: () => void) => {
        if (!active) return () => undefined;
        const id = setInterval(l, 1000);
        return () => clearInterval(id);
      },
      [active]
    ),
    () => Math.floor(Date.now() / 1000),
    () => 0
  );
  return tick * 1000 + offsetMs;
}

/** Test seam: forget everything. */
export function resetMyDayForTests(): void {
  state = LOADING;
}
