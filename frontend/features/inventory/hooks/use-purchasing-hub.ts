import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { getPurchasingHistory, getPurchasingSummary, listExpectedDeliveries } from '../services/receiving-api-service';
import type { ExpectedDeliverySummary, PurchasingHistoryRow, PurchasingSummary } from '../types/receiving';

/**
 * Preview batch size for the hub's Inbound/History bands (2026-09-17 UI
 * refinement) — the hub only ever needs enough rows to fill a compact
 * preview with a "View all" link (see `HUB_PREVIEW_ROW_COUNT` in
 * `purchasing-hub-screen.tsx`); full pagination now lives on the dedicated
 * `/purchasing/inbound` and `/purchasing/history` pages
 * (`use-inbound-list.ts`, `use-purchasing-history-list.ts`), which fetch
 * independently rather than sharing this hook's state.
 */
const PREVIEW_SIZE = 8;

/**
 * Purchasing hub (`U7V-0`/`WUL-0`) data-loading hook — the 3-tile KPI strip
 * (plan §7 Q1: `IN TRANSIT` dropped), plus a preview batch of the Inbound
 * and History bands. Loaded together since all three come from the same
 * screen and share one loading/error state (`WK4-0`/`WPL-0`).
 */
export function usePurchasingHub() {
  const [summary, setSummary] = useState<PurchasingSummary | null>(null);
  const [inbound, setInbound] = useState<ExpectedDeliverySummary[]>([]);
  const [history, setHistory] = useState<PurchasingHistoryRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isStale: () => boolean) => {
    setStatus('loading');
    setError(null);
    try {
      const [summaryResponse, inboundResponse, historyResponse] = await Promise.all([
        getPurchasingSummary(),
        listExpectedDeliveries({ status: 'AWAITING', limit: PREVIEW_SIZE }),
        getPurchasingHistory({ limit: PREVIEW_SIZE }),
      ]);
      // React 18 StrictMode (dev only) double-invokes this effect, firing two
      // overlapping loads; without this guard the earlier request can resolve
      // after the later one and clobber fresh state with stale rows (seen
      // live: a cancelled/received expected delivery reappearing after the
      // API had already stopped returning it).
      if (isStale()) return;
      setSummary(summaryResponse);
      setInbound(inboundResponse);
      setHistory(historyResponse);
      setStatus('ready');
    } catch (err) {
      if (isStale()) return;
      setError(formatApiErrorMessage(err, 'Something went wrong fetching inbound purchases and receipts.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let stale = false;
    void load(() => stale);
    return () => {
      stale = true;
    };
  }, [load]);

  const reload = useCallback(() => load(() => false), [load]);

  return { summary, inbound, history, status, error, reload };
}
