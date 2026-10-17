'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';

import { peopleWrites } from '../../_shared/services/people-writes';
import { REVEAL_MS } from '../lib/sensitive-fields';

/**
 * Shows one masked value in clear for 30 seconds. "Show" asks the server (which writes the opening to the audit log), "Hide" or the
 * clock puts it away. The clear value lives only in this hook's state and is dropped on unmount.
 */
export interface Reveal {
  shown: Record<string, string | null>;
  busy: string | null;
  error: string | null;
  show: (field: string) => Promise<void>;
  hide: (field: string) => void;
}

export function useReveal(employeeId: string): Reveal {
  const [shown, setShown] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef(new Map<string, number>());

  const hide = useCallback((field: string) => {
    window.clearTimeout(timers.current.get(field));
    timers.current.delete(field);
    setShown((s) => {
      const next = { ...s };
      delete next[field];
      return next;
    });
  }, []);

  const show = useCallback(
    async (field: string) => {
      setBusy(field);
      setError(null);
      try {
        const result = await peopleWrites.reveal(employeeId, field);
        setShown((s) => ({ ...s, [field]: result.value }));
        window.clearTimeout(timers.current.get(field));
        timers.current.set(field, window.setTimeout(() => hide(field), REVEAL_MS));
      } catch (err) {
        setError(formatApiErrorMessage(err, 'We could not show that. Try again.'));
      } finally {
        setBusy(null);
      }
    },
    [employeeId, hide]
  );

  useEffect(() => {
    const live = timers.current;
    return () => {
      live.forEach((t) => window.clearTimeout(t));
      live.clear();
    };
  }, []);

  return { shown, busy, error, show, hide };
}
