import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { listRestockBranches } from '../services';
import type { RestockBranchOption } from '../types';

/** The branches behind the department chips on Restock levels. `enabled: false` skips the request. */
export function useRestockBranches(enabled = true) {
  const [branches, setBranches] = useState<RestockBranchOption[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      setBranches(await listRestockBranches());
      setStatus('ready');
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load the branches.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (enabled) void load();
  }, [load, enabled]);

  return { branches, status, error, reload: load };
}
