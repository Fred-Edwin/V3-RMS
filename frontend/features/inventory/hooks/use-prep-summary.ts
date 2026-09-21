import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { getPrepSummary } from '../services/prep-api-service';
import type { PrepSummary } from '../types/prep';

/**
 * KPI strip data for the Prep runs list ("Runs this week / Yield flags /
 * Prep value") and Prep History ("Runs in range / Total input cost / Yield
 * flags", scoped to the active filter range). Single-GET shape, same as
 * `use-purchasing-hub.ts`'s summary fetch. `dateFrom`/`dateTo` undefined
 * means "this week" server-side default is not assumed here — callers pass
 * an explicit range when they want one scoped.
 */
export function usePrepSummary(dateFrom?: string, dateTo?: string) {
  const [summary, setSummary] = useState<PrepSummary | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isStale: () => boolean) => {
    setStatus('loading');
    setError(null);
    try {
      const result = await getPrepSummary({ dateFrom, dateTo });
      if (isStale()) return;
      setSummary(result);
      setStatus('ready');
    } catch (err) {
      if (isStale()) return;
      setError(formatApiErrorMessage(err, 'Could not load the prep summary.'));
      setStatus('error');
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    let stale = false;
    void load(() => stale);
    return () => {
      stale = true;
    };
  }, [load]);

  const reload = useCallback(() => load(() => false), [load]);

  return { summary, status, error, reload };
}
