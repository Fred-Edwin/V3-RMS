import { useCallback, useEffect, useState } from 'react';

import { ApiError, formatApiErrorMessage } from '@/types/api';
import { getSupplierApDetail } from '../services/receiving-api-service';
import type { SupplierApDetail } from '../types/receiving';

/**
 * Supplier detail — `VND-0`/`WZF-0`. Pure load hook, same shape as
 * `useGoodsReceiptDetail`, but also surfaces `isForbidden` (real 403 path,
 * same STORE_ATTENDANT case as the Suppliers list — plan §3a row 9).
 */
export function useSupplierApDetail(supplierId: string) {
  const [detail, setDetail] = useState<SupplierApDetail | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setIsForbidden(false);
    setIsNotFound(false);
    try {
      const result = await getSupplierApDetail(supplierId);
      setDetail(result);
      setStatus('ready');
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 403) setIsForbidden(true);
      if (err instanceof ApiError && err.statusCode === 404) setIsNotFound(true);
      setError(formatApiErrorMessage(err, 'Could not load this supplier.'));
      setStatus('error');
    }
  }, [supplierId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { detail, status, error, isForbidden, isNotFound, reload: load };
}
