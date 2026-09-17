import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { getPurchasingHistory, getPurchasingSummary, listExpectedDeliveries } from '../services/receiving-api-service';
import type { ExpectedDeliverySummary, PurchasingHistoryRow, PurchasingSummary } from '../types/receiving';

const PAGE_SIZE = 25;

/**
 * Purchasing hub (`U7V-0`/`WUL-0`) data-loading hook — the 3-tile KPI strip
 * (plan §7 Q1: `IN TRANSIT` dropped), the Inbound band, and the History
 * band. Loaded together since all three come from the same screen and share
 * one loading/error state (`WK4-0`/`WPL-0`).
 *
 * Table/list quality bar (`04-components.md`, 2026-09-16): every list here
 * must page past its first `limit` rather than rendering everything
 * unbounded, using the real `limit`/`cursor` params.
 *
 * **Inbound uses real cursor pagination** — `GET /inventory/expected-deliveries`
 * accepts `cursor` end to end (`receiving-repository.ts`'s
 * `findAllByOrganization` takes `{ cursor: { id }, skip: 1 }`), so "load
 * more" pages by the last row's `id`, standard cursor-pagination shape. The
 * endpoint returns a plain array with no `hasMore`/`nextCursor` field, so
 * "more available" is inferred from `results.length === limit` — the
 * conventional signal for this response shape.
 *
 * **History has no real cursor to page by — this is a backend gap, not a
 * frontend choice.** `GET /inventory/purchasing/history`'s controller
 * schema (`PurchasingHistoryQuerySchema`) and its repository method
 * (`findHistoryRows`) both omit `cursor` entirely, even though plan §3.2's
 * prose lists it — the plan predates what S3 actually shipped, and per
 * `API_CONTRACT.md` §22.1 ("the contract is committed code, not this
 * prose"), the committed code wins. S5 is frontend-only against S3's real
 * endpoints, so this session cannot add repository/controller cursor
 * support without going out of scope. The interim "load more" instead
 * re-fetches with a larger `limit` (25 → 50 → 75, replacing the dataset
 * each time) — real paging behavior for the person using it (never an
 * unbounded initial render), just not cursor-based underneath. Flagged here
 * for whichever session next touches `receiving-repository.ts` to add real
 * cursor support to `findHistoryRows`.
 */
export function usePurchasingHub() {
  const [summary, setSummary] = useState<PurchasingSummary | null>(null);
  const [inbound, setInbound] = useState<ExpectedDeliverySummary[]>([]);
  const [inboundHasMore, setInboundHasMore] = useState(false);
  const [inboundLoadingMore, setInboundLoadingMore] = useState(false);
  const [history, setHistory] = useState<PurchasingHistoryRow[]>([]);
  const [historyLimit, setHistoryLimit] = useState(PAGE_SIZE);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setHistoryLimit(PAGE_SIZE);
    try {
      const [summaryResponse, inboundResponse, historyResponse] = await Promise.all([
        getPurchasingSummary(),
        listExpectedDeliveries({ status: 'AWAITING', limit: PAGE_SIZE }),
        getPurchasingHistory({ limit: PAGE_SIZE }),
      ]);
      setSummary(summaryResponse);
      setInbound(inboundResponse);
      setInboundHasMore(inboundResponse.length === PAGE_SIZE);
      setHistory(historyResponse);
      setHistoryHasMore(historyResponse.length === PAGE_SIZE);
      setStatus('ready');
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Something went wrong fetching inbound purchases and receipts.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMoreInbound = useCallback(async () => {
    const lastId = inbound[inbound.length - 1]?.id;
    if (!lastId || inboundLoadingMore) return;
    setInboundLoadingMore(true);
    try {
      const next = await listExpectedDeliveries({ status: 'AWAITING', limit: PAGE_SIZE, cursor: lastId });
      setInbound((prev) => [...prev, ...next]);
      setInboundHasMore(next.length === PAGE_SIZE);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load more purchases.'));
    } finally {
      setInboundLoadingMore(false);
    }
  }, [inbound, inboundLoadingMore]);

  const loadMoreHistory = useCallback(async () => {
    if (historyLoadingMore) return;
    const nextLimit = historyLimit + PAGE_SIZE;
    setHistoryLoadingMore(true);
    try {
      const next = await getPurchasingHistory({ limit: nextLimit });
      setHistory(next);
      setHistoryHasMore(next.length === nextLimit);
      setHistoryLimit(nextLimit);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load more history.'));
    } finally {
      setHistoryLoadingMore(false);
    }
  }, [historyLimit, historyLoadingMore]);

  return {
    summary,
    inbound,
    inboundHasMore,
    inboundLoadingMore,
    loadMoreInbound,
    history,
    historyHasMore,
    historyLoadingMore,
    loadMoreHistory,
    status,
    error,
    reload: load,
  };
}
