import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { listPrepRuns } from '../services/prep-api-service';
import type { PrepRunSummary, YieldFlagFilter } from '../types/prep';

const PAGE_SIZE = 25;

export interface PrepRunsListFilters {
  search: string;
  outputItemId?: string;
  yieldFlag?: YieldFlagFilter;
  dateFrom?: string;
  dateTo?: string;
}

const EMPTY_FILTERS: PrepRunsListFilters = { search: '' };

/**
 * Prep runs list / Prep History data-loading hook — real cursor pagination
 * (`GET /inventory/prep/runs`), same shape as `use-receiving-history-list.ts`.
 * `setFilters` replaces the whole filter object in one call, same rationale
 * as that hook: the filter bar changes several fields together.
 */
export function usePrepRunsList() {
  const [rows, setRows] = useState<PrepRunSummary[]>([]);
  const [filters, setFilters] = useState<PrepRunsListFilters>(EMPTY_FILTERS);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: PrepRunsListFilters, isStale: () => boolean) => {
    setStatus('loading');
    setError(null);
    try {
      const response = await listPrepRuns({
        limit: PAGE_SIZE,
        search: f.search || undefined,
        outputItemId: f.outputItemId,
        yieldFlag: f.yieldFlag,
        dateFrom: f.dateFrom,
        dateTo: f.dateTo,
      });
      if (isStale()) return;
      setRows(response);
      setHasMore(response.length === PAGE_SIZE);
      setStatus('ready');
    } catch (err) {
      if (isStale()) return;
      setError(formatApiErrorMessage(err, 'Could not load prep runs.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let stale = false;
    void load(filters, () => stale);
    return () => {
      stale = true;
    };
  }, [filters, load]);

  const loadMore = useCallback(async () => {
    const lastId = rows[rows.length - 1]?.id;
    if (!lastId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = await listPrepRuns({
        limit: PAGE_SIZE,
        search: filters.search || undefined,
        outputItemId: filters.outputItemId,
        yieldFlag: filters.yieldFlag,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        cursor: lastId,
      });
      setRows((prev) => [...prev, ...next]);
      setHasMore(next.length === PAGE_SIZE);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load more prep runs.'));
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
    reload: () => load(filters, () => false),
  };
}
