import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { listDispatchQueue } from '../services';
import type { DispatchQueueRow } from '../types';

/** Central Store dispatch queue — approved requisitions across every branch, oldest first. Mirrors `use-requisitions-for-approval.ts`. */
export function useDispatchQueue() {
  const [rows, setRows] = useState<DispatchQueueRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isStale: () => boolean) => {
    setStatus('loading');
    setError(null);
    try {
      const list = await listDispatchQueue({ limit: 50 });
      if (isStale()) return;
      setRows(list);
      setStatus('ready');
    } catch (err) {
      if (isStale()) return;
      setError(formatApiErrorMessage(err, 'Could not load the dispatch queue.'));
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
