import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { listExpectedDeliveries } from '../services/receiving-api-service';
import type { ExpectedDeliverySummary } from '../types/receiving';

const PAGE_SIZE = 25;

/**
 * Dedicated Inbound page (2026-09-17 UI refinement) — the full worklist of
 * open `ExpectedDelivery` rows, with real cursor pagination and a search
 * box, split out of the Purchasing hub's compact preview band. Uses the same
 * `GET /inventory/expected-deliveries` endpoint `usePurchasingHub`'s preview
 * used, just without the hub's row cap.
 */
export function useInboundList() {
  const [rows, setRows] = useState<ExpectedDeliverySummary[]>([]);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (searchValue: string) => {
    setStatus('loading');
    setError(null);
    try {
      const response = await listExpectedDeliveries({
        status: 'AWAITING',
        limit: PAGE_SIZE,
        search: searchValue || undefined,
      });
      setRows(response);
      setHasMore(response.length === PAGE_SIZE);
      setStatus('ready');
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Something went wrong fetching expected deliveries.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load(search);
  }, [search, load]);

  const loadMore = useCallback(async () => {
    const lastId = rows[rows.length - 1]?.id;
    if (!lastId || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await listExpectedDeliveries({
        status: 'AWAITING',
        limit: PAGE_SIZE,
        cursor: lastId,
        search: search || undefined,
      });
      setRows((prev) => [...prev, ...next]);
      setHasMore(next.length === PAGE_SIZE);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load more expected deliveries.'));
    } finally {
      setLoadingMore(false);
    }
  }, [rows, loadingMore, search]);

  return { rows, search, setSearch, hasMore, loadingMore, loadMore, status, error, reload: () => load(search) };
}
