import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { getTypicalYield } from '../services/prep-api-service';
import type { TypicalYield } from '../types/prep';

/**
 * New Prep Run's "Typical: ~6kg chicken -> ~22L" nudge — fires the moment an
 * output item is picked, before any input lines exist. `outputItemId` null
 * means no output picked yet; the hook stays idle.
 */
export function useTypicalYield(outputItemId: string | null) {
  const [typicalYield, setTypicalYield] = useState<TypicalYield | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string, isStale: () => boolean) => {
    setStatus('loading');
    setError(null);
    try {
      const result = await getTypicalYield(id);
      if (isStale()) return;
      setTypicalYield(result);
      setStatus('ready');
    } catch (err) {
      if (isStale()) return;
      setError(formatApiErrorMessage(err, 'Could not load the typical yield for this item.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!outputItemId) {
      setTypicalYield(null);
      setStatus('idle');
      return;
    }
    let stale = false;
    void load(outputItemId, () => stale);
    return () => {
      stale = true;
    };
  }, [outputItemId, load]);

  return { typicalYield, status, error };
}
