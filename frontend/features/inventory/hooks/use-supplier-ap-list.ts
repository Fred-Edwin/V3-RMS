import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, formatApiErrorMessage } from '@/types/api';
import { getApSummary, listSupplierAp } from '../services/receiving-api-service';
import type { ApSummary, ListSupplierApQuery, SupplierApRow } from '../types/receiving';
import type { SupplierPaymentTerms } from '../types';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

export interface SupplierApFilters {
  search?: string;
  terms?: SupplierPaymentTerms;
  hasBalance?: boolean;
  agingBucket?: ListSupplierApQuery['agingBucket'];
}

/**
 * Suppliers screen ("what we owe") — `GET /inventory/ap/summary` (KPI strip)
 * + `GET /inventory/ap/suppliers` (how-overdue table), real cursor
 * pagination now that `listSupplierAp` applies `limit`/`cursor` for real
 * (2026-09-18 backend amendment, receiving-validators.ts header) rather than
 * the limit-bump workaround this module's other list hooks still use.
 * `hasMore` is inferred from `rows.length === PAGE_SIZE` on the last page
 * fetched, same convention as `use-purchasing-history-list.ts`.
 *
 * AMENDMENT 2026-09-18 (owner feedback during manual walkthrough): two bugs
 * fixed together, since they had the same root cause. Typing in the search
 * box refetched on every keystroke, and every refetch (including the first
 * one triggered by a keystroke) set `status: 'loading'` — the screen swaps
 * its whole populated body for a skeleton on `loading`, which unmounts the
 * `<input>` the person was typing in and drops focus/causes a visible
 * flicker. Fixed two ways:
 *  1. `search` is debounced 300ms before it's actually sent to the API —
 *     `filters.search` (what the input is bound to) and the value used in
 *     the request are now different variables.
 *  2. `status` only ever goes to `'loading'` for the very first fetch.
 *     Every subsequent fetch (typing, changing a filter, paging) is tracked
 *     by a separate `isRefetching` flag instead, so the screen keeps
 *     rendering the current table/input while a refresh happens in the
 *     background rather than tearing it down.
 */
export function useSupplierApList(filters: SupplierApFilters) {
  const [summary, setSummary] = useState<ApSummary | null>(null);
  const [rows, setRows] = useState<SupplierApRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  const { terms, hasBalance, agingBucket } = filters;

  // Debounce the search term only — the other filters (dropdowns) already
  // fire once per real change, no debounce needed for those.
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (hasLoadedOnce.current) {
      setIsRefetching(true);
    } else {
      setStatus('loading');
    }
    setError(null);
    setIsForbidden(false);
    try {
      const [summaryResult, rowsResult] = await Promise.all([
        getApSummary(),
        listSupplierAp({ search: debouncedSearch, terms, hasBalance, agingBucket, limit: PAGE_SIZE }),
      ]);
      setSummary(summaryResult);
      setRows(rowsResult);
      setHasMore(rowsResult.length === PAGE_SIZE);
      setStatus('ready');
      hasLoadedOnce.current = true;
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 403) {
        setIsForbidden(true);
      }
      setError(formatApiErrorMessage(err, 'Could not load suppliers.'));
      setStatus('error');
    } finally {
      setIsRefetching(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, terms, hasBalance, agingBucket]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || rows.length === 0) return;
    setLoadingMore(true);
    try {
      const next = await listSupplierAp({
        search: debouncedSearch,
        terms,
        hasBalance,
        agingBucket,
        limit: PAGE_SIZE,
        cursor: rows[rows.length - 1]!.supplierId,
      });
      setRows((prev) => [...prev, ...next]);
      setHasMore(next.length === PAGE_SIZE);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load more suppliers.'));
    } finally {
      setLoadingMore(false);
    }
  }, [agingBucket, debouncedSearch, hasBalance, loadingMore, rows, terms]);

  const reload = useCallback(() => {
    hasLoadedOnce.current = false;
    return load();
  }, [load]);

  return { summary, rows, status, isRefetching, error, isForbidden, hasMore, loadingMore, loadMore, reload };
}
