'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';

import { toRemoteError } from '../../../_shared';
import { attendanceWrites } from '../../_shared/services/attendance-services';
import type { ClockOutBody, StayOnBody, TapBody } from '../../_shared/types/attendance-types';
import { dequeue, enqueue, loadQueue, newTapId, readyToSend, type QueuedTap } from '../lib/offline-queue';

/**
 * The phone's taps: clock in, clock out, undo, "Stay on". A tap made with no signal is kept on the phone with the phone's own time and
 * sent when the signal returns (the same `clientEventId` every time, so a retry makes no second event). Words for a refusal are the
 * server's own. After any change the caller reloads "my day".
 */

export interface ClockActions {
  busy: boolean;
  error: string | null;
  /** Taps kept on this phone, waiting to be sent. */
  queued: readonly QueuedTap[];
  /** The browser would not keep a tap made offline. */
  notSaved: boolean;
  clearError: () => void;
  clockIn: (rotaEntryId: string | undefined) => Promise<boolean>;
  clockOut: (rotaEntryId: string | undefined, reasonCode?: string) => Promise<boolean>;
  undo: () => Promise<boolean>;
  stayOn: (body: StayOnBody) => Promise<boolean>;
}

/** The phone's position for the branch check, or nothing when the person said no or the phone cannot tell. */
function position(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}

const isOffline = (err: unknown): boolean => toRemoteError(err).status === 0;

export function useClockActions(onChanged: () => void): ClockActions {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState<readonly QueuedTap[]>([]);
  const [notSaved, setNotSaved] = useState(false);
  const flushing = useRef(false);
  const changed = useRef(onChanged);
  changed.current = onChanged;

  const send = useCallback((tap: QueuedTap) => (tap.kind === 'IN' ? attendanceWrites.clockIn(readyToSend(tap) as TapBody) : attendanceWrites.clockOut(readyToSend(tap) as ClockOutBody)), []);

  const flush = useCallback(async (): Promise<void> => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (const tap of loadQueue()) {
        try {
          await send(tap);
          dequeue(tap.body.clientEventId);
        } catch (err) {
          if (isOffline(err)) break;
          // The server answered with a refusal: the tap can never be accepted, so it must not block the ones behind it.
          dequeue(tap.body.clientEventId);
          setError(formatApiErrorMessage(err, 'A tap kept on this phone could not be sent.'));
        }
      }
    } finally {
      flushing.current = false;
      setQueued(loadQueue());
      changed.current();
    }
  }, [send]);

  useEffect(() => {
    setQueued(loadQueue());
    void flush();
    const again = (): void => void flush();
    window.addEventListener('online', again);
    const id = setInterval(again, 20_000);
    return () => {
      window.removeEventListener('online', again);
      clearInterval(id);
    };
  }, [flush]);

  const tap = useCallback(
    async (kind: 'IN' | 'OUT', rotaEntryId: string | undefined, reasonCode?: string): Promise<boolean> => {
      setBusy(true);
      setError(null);
      setNotSaved(false);
      const pos = await position();
      const deviceAt = new Date().toISOString();
      const body: TapBody | ClockOutBody = { clientEventId: newTapId(), ...(rotaEntryId ? { rotaEntryId } : {}), ...(pos ?? {}), ...(reasonCode ? { reasonCode } : {}) };
      const queuedTap: QueuedTap = { kind, deviceAt, body };
      try {
        await send(queuedTap);
        changed.current();
        return true;
      } catch (err) {
        if (isOffline(err)) {
          const kept = enqueue(queuedTap);
          setNotSaved(!kept);
          setQueued(loadQueue());
          return kept;
        }
        setError(formatApiErrorMessage(err, 'That did not go through. Nothing was recorded.'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [send]
  );

  const guarded = useCallback(async (write: () => Promise<unknown>, fallback: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await write();
      changed.current();
      return true;
    } catch (err) {
      setError(formatApiErrorMessage(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    busy,
    error,
    queued,
    notSaved,
    clearError: useCallback(() => setError(null), []),
    clockIn: (rotaEntryId) => tap('IN', rotaEntryId),
    clockOut: (rotaEntryId, reasonCode) => tap('OUT', rotaEntryId, reasonCode),
    undo: () => guarded(() => attendanceWrites.undo(newTapId()), 'That could not be undone.'),
    stayOn: (body) => guarded(() => attendanceWrites.stayOn(body), 'That did not go through. Nothing was recorded.'),
  };
}
