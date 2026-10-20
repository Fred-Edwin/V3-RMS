'use client';

import { useCallback, useState } from 'react';

import { ApiError, formatApiErrorMessage } from '@/types/api';

import { useRemote, useWorkforceNudge } from '../../_shared';
import { alertReads, alertWrites, newKey } from '../services/security-services';
import type { AlertCounts, AlertKind, AlertList, AlertRow, AlertStatus } from '../types/security-types';

export type StatusChoice = AlertStatus | 'ALL';

/**
 * The System Admin's alert list: the status chip, the kind filter and the numbered pager, the counts on the chips, and the two writes (clear
 * with a note, start alerts). Both lists read again on the `workforce:needs-you` nudge (an alert is also a Needs you row). Two System Admins
 * clearing at once: the second gets `ALREADY_CLEARED` naming who, and the list is read again so the row shows it.
 */
export function useAlerts() {
  const [status, setStatus] = useState<StatusChoice>('OPEN');
  const [kind, setKind] = useState<AlertKind | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const key = `alerts:${status}:${kind ?? 'any'}:${page}:${pageSize}`;
  const list = useRemote<AlertList>(() => alertReads.list({ page, pageSize, ...(status !== 'ALL' ? { status } : {}), ...(kind ? { kind } : {}) }), key);
  const counts = useRemote<AlertCounts>(() => alertReads.counts(), 'alert-counts');
  const { reload: reloadList } = list;
  const { reload: reloadCounts } = counts;
  const reload = useCallback((): void => {
    reloadList();
    reloadCounts();
  }, [reloadList, reloadCounts]);
  useWorkforceNudge(['workforce:needs-you'], reload);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clear = useCallback(
    async (alert: AlertRow, note: string): Promise<AlertRow | null> => {
      setBusy(true);
      setError(null);
      try {
        const cleared = await alertWrites.clear(alert.id, note.trim(), newKey());
        reload();
        return cleared;
      } catch (err) {
        if (err instanceof ApiError && err.code === 'ALREADY_CLEARED') reload();
        setError(formatApiErrorMessage(err, 'We could not clear that alert. Nothing was changed.'));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [reload]
  );

  const start = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await alertWrites.start();
      reloadCounts();
    } catch (err) {
      setError(formatApiErrorMessage(err, 'We could not start alerts. Nothing was changed.'));
    } finally {
      setBusy(false);
    }
  }, [reloadCounts]);

  const choose = useCallback((next: StatusChoice): void => {
    setStatus(next);
    setPage(1);
  }, []);
  const chooseKind = useCallback((next: AlertKind | null): void => {
    setKind(next);
    setPage(1);
  }, []);
  const changePageSize = useCallback((n: number): void => {
    setPageSize(n);
    setPage(1);
  }, []);

  return { status, kind, page, pageSize, list, counts, busy, error, clearError: () => setError(null), setPage, changePageSize, choose, chooseKind, clear, start, reload };
}
