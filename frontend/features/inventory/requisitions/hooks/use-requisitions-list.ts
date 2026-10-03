import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { listRequisitions } from '../services';
import { isLockedByApproval } from '../lib/requisition-display-status';
import type { RequisitionListRow } from '../types';

/**
 * Loads the caller's requisitions (role-scoped by the backend to their own
 * branch/department view). Powers both screen 1's grouped rendering (NEEDS
 * YOUR SECTION / EARLIER TODAY, derived client-side from each row's
 * `mySectionStatus`) and screen 0's REQUISITION card (the single
 * most-recent entry). Stale-closure-flag pattern for refetch races, matching
 * `use-prep-runs-list.ts`.
 */
export function useRequisitionsList() {
  const [rows, setRows] = useState<RequisitionListRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isStale: () => boolean) => {
    setStatus('loading');
    setError(null);
    try {
      const list = await listRequisitions({ limit: 25 });
      if (isStale()) return;
      setRows(list);
      setStatus('ready');
    } catch (err) {
      if (isStale()) return;
      setError(formatApiErrorMessage(err, 'Could not load requisitions.'));
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

  // NOT_STARTED/DRAFT -> "needs your section" (primary CTA); everything
  // else (SUBMITTED/RETURNED — RETURNED also needs attention but the fill
  // screen surfaces that, not this grouping) -> "earlier today".
  const needsSection = useMemo(
    () => rows.filter((r) => !isLockedByApproval(r) && (r.mySectionStatus === 'NOT_STARTED' || r.mySectionStatus === 'DRAFT' || r.mySectionStatus === 'RETURNED')),
    [rows],
  );
  const earlierToday = useMemo(
    () => rows.filter((r) => isLockedByApproval(r) || r.mySectionStatus === 'SUBMITTED'),
    [rows],
  );
  const mostRecent = rows[0] ?? null;

  return { rows, needsSection, earlierToday, mostRecent, status, error, reload };
}
