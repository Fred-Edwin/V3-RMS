import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { getPurchasingHistory } from '../services/receiving-api-service';
import type { PurchasingHistoryRow } from '../types/receiving';

const PAGE_SIZE = 25;

/**
 * Dedicated History page (2026-09-17 UI refinement) — the full purchasing
 * ledger (all `ExpectedDelivery`/`GoodsReceipt` rows), split out of the
 * Purchasing hub's compact preview band. Adds a search box on top of what
 * the hub's preview already fetched.
 *
 * **Still no real cursor to page by — this is the same backend gap
 * `use-purchasing-hub.ts` already documented, unchanged by this refinement.**
 * `GET /inventory/purchasing/history` has no `cursor` support server-side
 * (`PurchasingHistoryQuerySchema`/`findHistoryRows` both omit it). "Load
 * more" here uses the same limit-bump workaround (25 → 50 → 75, replacing
 * the dataset each time) rather than true cursor pagination. Flagged again
 * here for whichever session next touches `receiving-repository.ts` to add
 * real cursor support to `findHistoryRows` — this dedicated page is exactly
 * where that fix will actually matter (a supplier with hundreds of
 * historical rows), unlike the hub's 8-row preview.
 */
export function usePurchasingHistoryList() {
  const [rows, setRows] = useState<PurchasingHistoryRow[]>([]);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (searchValue: string, isStale: () => boolean) => {
    setStatus('loading');
    setError(null);
    setLimit(PAGE_SIZE);
    try {
      const response = await getPurchasingHistory({ limit: PAGE_SIZE, search: searchValue || undefined });
      // Guards against React 18 StrictMode's dev-only double-invoke, and a
      // stale in-flight search request resolving after a newer one.
      if (isStale()) return;
      setRows(response);
      setHasMore(response.length === PAGE_SIZE);
      setStatus('ready');
    } catch (err) {
      if (isStale()) return;
      setError(formatApiErrorMessage(err, 'Something went wrong fetching purchasing history.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let stale = false;
    void load(search, () => stale);
    return () => {
      stale = true;
    };
  }, [search, load]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    const nextLimit = limit + PAGE_SIZE;
    setLoadingMore(true);
    try {
      const next = await getPurchasingHistory({ limit: nextLimit, search: search || undefined });
      setRows(next);
      setHasMore(next.length === nextLimit);
      setLimit(nextLimit);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load more history.'));
    } finally {
      setLoadingMore(false);
    }
  }, [limit, loadingMore, search]);

  return { rows, search, setSearch, hasMore, loadingMore, loadMore, status, error, reload: () => load(search, () => false) };
}
