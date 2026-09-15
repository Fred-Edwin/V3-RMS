import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/types/api';
import { listSuppliers } from '../services';
import type { Supplier } from '../types';

/** Suppliers list — backs whichever screen opens the New/edit supplier drawer. */
export function useSuppliers(search?: string) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const response = await listSuppliers({ search, includeRetired: false, perPage: 100 });
      setSuppliers(response.data);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load suppliers.');
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  return { suppliers, status, error, reload: load };
}
