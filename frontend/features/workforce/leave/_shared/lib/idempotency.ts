'use client';

import { useCallback, useMemo, useRef } from 'react';

/** A fresh key for one intent. 8 to 80 characters is what the server accepts; a UUID is 36. */
export const newKey = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

/**
 * One key per intent: the same key is used again for a retry or a double tap (the server answers the first result), and `fresh()` is
 * called when the intent changes (new dates, a dialog opened again) or after a success. The key never changes while a send is in flight.
 */
export function useIdempotencyKey(): { current: () => string; fresh: () => void } {
  const ref = useRef<string | null>(null);
  const current = useCallback((): string => {
    if (ref.current === null) ref.current = newKey();
    return ref.current;
  }, []);
  const fresh = useCallback(() => {
    ref.current = null;
  }, []);
  // One object for the life of the component: dialogs list `key` in effect dependencies, and a new object each render re-ran
  // those effects after every render (clearing a wrong-PIN message the moment it appeared and renewing the key on a retry).
  return useMemo(() => ({ current, fresh }), [current, fresh]);
}
