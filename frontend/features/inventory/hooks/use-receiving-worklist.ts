import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { listExpectedDeliveries } from '../services/receiving-api-service';
import type { ExpectedDeliverySummary } from '../types/receiving';

const PAGE_SIZE = 25;

/**
 * Receiving worklist (`UMS-0`/`WSO-0`, Attendant-only) — "Expected today".
 * Same `GET /inventory/expected-deliveries` endpoint the Purchasing hub's
 * Inbound band uses; the Attendant's response simply omits `estimatedTotal`
 * (serializer-level, plan §3.1) so this hook renders whatever the backend
 * sends rather than filtering client-side.
 *
 * Table/list quality bar (`04-components.md`, 2026-09-16): real cursor
 * pagination — `GET /inventory/expected-deliveries` accepts `cursor` end to
 * end (same endpoint the Purchasing hub's `usePurchasingHub` pages), so
 * "load more" pages by the last row's `id`. "More available" is inferred
 * from `results.length === limit` since the endpoint returns a plain array
 * with no `hasMore` field.
 */
export function useReceivingWorklist() {
  const [deliveries, setDeliveries] = useState<ExpectedDeliverySummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const response = await listExpectedDeliveries({ status: 'AWAITING', limit: PAGE_SIZE });
      setDeliveries(response);
      setHasMore(response.length === PAGE_SIZE);
      setStatus('ready');
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load the receiving worklist.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    const lastId = deliveries[deliveries.length - 1]?.id;
    if (!lastId || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await listExpectedDeliveries({ status: 'AWAITING', limit: PAGE_SIZE, cursor: lastId });
      setDeliveries((prev) => [...prev, ...next]);
      setHasMore(next.length === PAGE_SIZE);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load more deliveries.'));
    } finally {
      setLoadingMore(false);
    }
  }, [deliveries, loadingMore]);

  return { deliveries, hasMore, loadingMore, loadMore, status, error, reload: load };
}
