import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { getPrepRun } from '../services/prep-api-service';
import type { PrepRunDetail } from '../types/prep';

/**
 * Prep run detail (immutable) — pure load hook, same shape as
 * `use-goods-receipt-detail.ts`.
 */
export function usePrepRunDetail(id: string) {
  const [run, setRun] = useState<PrepRunDetail | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    // Clear the previous run immediately — without this, switching from one
    // row's drawer straight to another's (same mounted component, id changes
    // without an intervening close) can render stale-but-`ready`-status data
    // for one tick, or race with the new fetch resolving out of order.
    setRun(null);
    try {
      const result = await getPrepRun(id);
      setRun(result);
      setStatus('ready');
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load this prep run.'));
      setStatus('error');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { run, status, error, reload: load };
}
