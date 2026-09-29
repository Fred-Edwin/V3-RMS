import { useCallback, useEffect, useRef, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import {
  getStockLedger,
  getStockSummary,
  listStock,
  listWaste,
  listWasteItemOptions,
} from '../services/stock-api-service';
import type { AttendantStockSummary, Ledger, LedgerQuery, ListStockQuery, StockList, StockSummary } from '../types/stock';
import type { WasteItemOption, WasteList } from '../types/waste';

export type ResourceStatus = 'loading' | 'error' | 'ready';

/**
 * One loader for every Milestone Six Session 1 read. `status` is `loading`
 * only while there is no data yet — a refetch (filter change, page change,
 * refresh after a mutation) keeps the previous data on screen and sets
 * `refreshing`, so tables don't flash back to skeletons (§4.2 "Async data").
 * `key` is the serialized request; a new key triggers a fetch, and a stale
 * response for an old key is dropped.
 */
export function useResource<T>(key: string | null, fetcher: () => Promise<T>, fallbackError: string) {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<ResourceStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const hasData = useRef(false);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    if (hasData.current) setRefreshing(true);
    else setStatus('loading');
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (ticket !== latest.current) return;
      hasData.current = true;
      setData(result);
      setStatus('ready');
    } catch (err) {
      if (ticket !== latest.current) return;
      setError(formatApiErrorMessage(err, fallbackError));
      setStatus('error');
    } finally {
      if (ticket === latest.current) setRefreshing(false);
    }
  }, [fallbackError]);

  useEffect(() => {
    if (key === null) return;
    void load();
    // `key` is the serialized request; `load` reads the latest fetcher from a ref.
  }, [key, load]);

  return { data, status, refreshing, error, reload: load };
}

/** `enabled: false` for roles the summary isn't for (a Department Head on the ledger picker) — no request at all. */
export function useStockSummary(enabled = true) {
  const r = useResource<StockSummary | AttendantStockSummary>(enabled ? 'summary' : null, getStockSummary, "Couldn't load the stock position.");
  return { summary: r.data, status: r.status, refreshing: r.refreshing, error: r.error, reload: r.reload };
}

export function useStockList(query: ListStockQuery, enabled = true) {
  const key = enabled ? JSON.stringify(query) : null;
  const r = useResource<StockList>(key, () => listStock(query), "Couldn't load the item list.");
  return { list: r.data, status: r.status, refreshing: r.refreshing, error: r.error, reload: r.reload };
}

export function useStockLedger(itemId: string | null, query: LedgerQuery) {
  const key = itemId ? `${itemId}:${JSON.stringify(query)}` : null;
  const r = useResource<Ledger>(key, () => getStockLedger(itemId as string, query), "Couldn't load the ledger.");
  return { ledger: r.data, status: r.status, refreshing: r.refreshing, error: r.error, reload: r.reload };
}

export function useWasteList(days = 7, enabled = true) {
  const r = useResource<WasteList>(enabled ? `waste:${days}` : null, () => listWaste(days), "Couldn't load waste.");
  return { waste: r.data, status: r.status, refreshing: r.refreshing, error: r.error, reload: r.reload };
}

export function useWasteItemOptions(search: string, enabled = true) {
  const r = useResource<{ items: WasteItemOption[] }>(
    enabled ? `waste-items:${search}` : null,
    () => listWasteItemOptions(search || undefined),
    "Couldn't load items.",
  );
  return { items: r.data?.items ?? [], status: r.status, refreshing: r.refreshing, error: r.error, reload: r.reload };
}

/** Debounced value — the All items / picker search waits 250ms after the last keystroke (§4.3). */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
