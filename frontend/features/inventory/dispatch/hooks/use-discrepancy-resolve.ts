import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { getDiscrepancy, resolveDiscrepancy } from '../services';
import type { DiscrepancyDetail, DiscrepancyOutcome } from '../types';

/** Detail + resolve action for one discrepancy (Store Manager only, sign+PIN). Mirrors `use-delivery-confirm.ts`'s load/sign shape. */
export function useDiscrepancyResolve(discrepancyId: string) {
  const [detail, setDetail] = useState<DiscrepancyDetail | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const load = useCallback(
    async (isStale: () => boolean) => {
      if (!discrepancyId) {
        setDetail(null);
        setStatus('idle');
        return;
      }
      setStatus('loading');
      setError(null);
      try {
        const data = await getDiscrepancy(discrepancyId);
        if (isStale()) return;
        setDetail(data);
        setStatus('ready');
      } catch (err) {
        if (isStale()) return;
        setError(formatApiErrorMessage(err, 'Could not load this discrepancy.'));
        setStatus('error');
      }
    },
    [discrepancyId],
  );

  useEffect(() => {
    let stale = false;
    void load(() => stale);
    return () => {
      stale = true;
    };
  }, [load]);

  const resolve = useCallback(
    async (outcome: DiscrepancyOutcome, resolutionNote: string, pin: string): Promise<boolean> => {
      setResolving(true);
      setResolveError(null);
      try {
        const updated = await resolveDiscrepancy(discrepancyId, { outcome, resolutionNote, pin });
        setDetail(updated);
        return true;
      } catch (err) {
        setResolveError(formatApiErrorMessage(err, 'Could not resolve this discrepancy.'));
        return false;
      } finally {
        setResolving(false);
      }
    },
    [discrepancyId],
  );

  return { detail, resolve, resolving, resolveError, status, error, reload: () => load(() => false) };
}
