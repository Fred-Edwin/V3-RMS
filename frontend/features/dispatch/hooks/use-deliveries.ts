import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { listDeliveries } from '../services';
import type { DeliveryRow } from '../types';

/** Branch's own dispatches — all departments (Branch Manager) or own department only (Department Head), per C4's scoping. Mirrors `use-dispatch-queue.ts`. */
export function useDeliveries() {
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isStale: () => boolean) => {
    setStatus('loading');
    setError(null);
    try {
      const list = await listDeliveries({ limit: 50 });
      if (isStale()) return;
      setRows(list);
      setStatus('ready');
    } catch (err) {
      if (isStale()) return;
      setError(formatApiErrorMessage(err, 'Could not load deliveries.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let stale = false;
    void load(() => stale);
    return () => {
      stale = true;
    };
  }, [load]);

  const reload = useCallback(() => load(() => false), [load]);

  return { rows, status, error, reload };
}
