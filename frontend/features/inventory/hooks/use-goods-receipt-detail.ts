import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { getGoodsReceipt } from '../services/receiving-api-service';
import type { GoodsReceiptDetail } from '../types/receiving';

/**
 * Goods Receipt detail (signed) — `UVN-0`. Pure load hook, same shape as
 * `useReceivingWorklist`. `id` in the dep array is a route param — stable
 * across a mount, but this re-fetches correctly if the App Router reuses the
 * component across sibling dynamic routes.
 */
export function useGoodsReceiptDetail(id: string) {
  const [receipt, setReceipt] = useState<GoodsReceiptDetail | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const result = await getGoodsReceipt(id);
      setReceipt(result);
      setStatus('ready');
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load this goods receipt.'));
      setStatus('error');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { receipt, status, error, reload: load };
}
