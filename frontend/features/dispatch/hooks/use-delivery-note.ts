import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { getDeliveryNote } from '../services';
import type { DeliveryNote } from '../types';

/** Shared by print and on-screen renderers — one Dispatch record, two views. */
export function useDeliveryNote(dispatchId: string) {
  const [note, setNote] = useState<DeliveryNote | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isStale: () => boolean) => {
      if (!dispatchId) {
        setStatus('idle');
        return;
      }
      setStatus('loading');
      setError(null);
      try {
        const data = await getDeliveryNote(dispatchId);
        if (isStale()) return;
        setNote(data);
        setStatus('ready');
      } catch (err) {
        if (isStale()) return;
        setError(formatApiErrorMessage(err, 'Could not load this delivery note.'));
        setStatus('error');
      }
    },
    [dispatchId],
  );

  useEffect(() => {
    let stale = false;
    void load(() => stale);
    return () => {
      stale = true;
    };
  }, [load]);

  return { note, status, error, reload: () => load(() => false) };
}
