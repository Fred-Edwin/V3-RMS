import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { getReceivingHistory } from '../services/receiving-api-service';
import type { PurchasingHistoryRow } from '../types/receiving';

const PAGE_SIZE = 25;

export interface ReceivingHistoryFilters {
  search: string;
  supplierId?: string;
  status?: string;
  from?: string;
  to?: string;
}

const EMPTY_FILTERS: ReceivingHistoryFilters = { search: '' };

/**
 * Dedicated Receiving History screen (2026-09-18, S6 — `docs/features/
 * inventory/06-sessions/milestone-2-s6-followup-receiving-history-handoff.md`).
 * Unlike `use-purchasing-history-list.ts`, this hook is Attendant-visible
 * (`GET /inventory/receiving/history`) and uses real cursor pagination —
 * `loadMore` appends by the last row's `id`, same shape as
 * `use-receiving-worklist.ts`, not the limit-bump workaround the Purchasing
 * hub's own history hook still carries.
 *
 * `setFilters` replaces the whole filter object in one call (search, status,
 * supplier, date range) rather than exposing five separate setters — the
 * screen's filter bar changes several of these together (e.g. clearing all
 * filters at once), and a single object avoids firing multiple redundant
 * reloads for one user action.
 */
export function useReceivingHistoryList() {
  const [rows, setRows] = useState<PurchasingHistoryRow[]>([]);
  const [filters, setFilters] = useState<ReceivingHistoryFilters>(EMPTY_FILTERS);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: ReceivingHistoryFilters) => {
    setStatus('loading');
    setError(null);
    try {
      const response = await getReceivingHistory({
        limit: PAGE_SIZE,
        search: f.search || undefined,
        supplierId: f.supplierId,
        status: f.status,
        from: f.from,
        to: f.to,
      });
      setRows(response);
      setHasMore(response.length === PAGE_SIZE);
      setStatus('ready');
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load receiving history.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load(filters);
  }, [filters, load]);

  const loadMore = useCallback(async () => {
    const lastId = rows[rows.length - 1]?.id;
    if (!lastId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = await getReceivingHistory({
        limit: PAGE_SIZE,
        search: filters.search || undefined,
        supplierId: filters.supplierId,
        status: filters.status,
        from: filters.from,
        to: filters.to,
        cursor: lastId,
      });
      setRows((prev) => [...prev, ...next]);
      setHasMore(next.length === PAGE_SIZE);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load more history.'));
    } finally {
      setLoadingMore(false);
    }
  }, [rows, loadingMore, hasMore, filters]);

  return {
    rows,
    filters,
    setFilters,
    hasMore,
    loadingMore,
    loadMore,
    status,
    error,
    reload: () => load(filters),
  };
}
