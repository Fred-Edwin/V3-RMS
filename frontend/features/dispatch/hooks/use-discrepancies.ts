import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { listDiscrepancies } from '../services';
import type { DiscrepancyRow } from '../types';

/** Role-gated list — Store Manager sees all branches, Branch Manager sees own branch (read-only). Mirrors `use-deliveries.ts`. */
export function useDiscrepancies() {
  const [rows, setRows] = useState<DiscrepancyRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isStale: () => boolean) => {
    setStatus('loading');
    setError(null);
    try {
      const list = await listDiscrepancies({ limit: 50 });
      if (isStale()) return;
      setRows(list);
      setStatus('ready');
    } catch (err) {
      if (isStale()) return;
      setError(formatApiErrorMessage(err, 'Could not load discrepancies.'));
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
