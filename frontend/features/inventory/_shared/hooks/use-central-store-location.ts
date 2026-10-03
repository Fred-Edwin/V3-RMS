import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { getCentralStoreLocation } from '../../services';

/**
 * Resolves the Central Store's locationId for a Store Manager, needed by the
 * restock-levels endpoints. Post-freeze addition (2026-09-15) — see
 * `inventory-api-service.ts`'s `getCentralStoreLocation` for why this exists.
 */
/** `enabled: false` skips the request — the Store Attendant has no access to this SM-only lookup. */
export function useCentralStoreLocation(enabled = true) {
  const [locationId, setLocationId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const { id } = await getCentralStoreLocation();
      setLocationId(id);
      setStatus('ready');
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not find the Central Store.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (enabled) void load();
  }, [load, enabled]);

  return { locationId, status, error, reload: load };
}
