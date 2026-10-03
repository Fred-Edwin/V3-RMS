import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { listRequisitionHistory } from '../services';
import type { ListRequisitionHistoryQuery, RequisitionHistoryRow } from '../types';

const LIMIT = 25;

/** Filterable Requisition History — cursor pagination, `hasMore` derived from a full page (matches `listRequisitionHistory`'s `limit`). */
export function useRequisitionHistory(filters: Omit<ListRequisitionHistoryQuery, 'limit' | 'cursor'>) {
  const [rows, setRows] = useState<RequisitionHistoryRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (isStale: () => boolean) => {
      setStatus('loading');
      setError(null);
      try {
        const data = await listRequisitionHistory({ ...filters, limit: LIMIT });
        if (isStale()) return;
        setRows(data);
        setStatus('ready');
      } catch (err) {
        if (isStale()) return;
        setError(formatApiErrorMessage(err, 'Could not load requisition history.'));
        setStatus('error');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filters is a plain object rebuilt every render; the screen passes primitive filter values through it, so this effect re-keys on their JSON below instead.
    [JSON.stringify(filters)],
  );

  useEffect(() => {
    let stale = false;
    void load(() => stale);
    return () => {
      stale = true;
    };
  }, [load]);

  const loadMore = useCallback(async () => {
    if (rows.length === 0) return;
    setLoadingMore(true);
    try {
      const cursor = rows[rows.length - 1]!.id;
      const more = await listRequisitionHistory({ ...filters, limit: LIMIT, cursor });
      setRows((prev) => [...prev, ...more]);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load more requisitions.'));
    } finally {
      setLoadingMore(false);
    }
  }, [rows, filters]);

  const hasMore = rows.length > 0 && rows.length % LIMIT === 0;

  return { rows, status, error, hasMore, loadingMore, loadMore, reload: () => load(() => false) };
}
