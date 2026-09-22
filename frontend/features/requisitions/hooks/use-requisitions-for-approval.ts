import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { listRequisitionsForApproval } from '../services';
import type { RequisitionManagerListRow } from '../types';

/** Manager's needs-approval list — today's requisitions across all departments. Mirrors `use-requisitions-list.ts`. */
export function useRequisitionsForApproval() {
  const [rows, setRows] = useState<RequisitionManagerListRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isStale: () => boolean) => {
    setStatus('loading');
    setError(null);
    try {
      const list = await listRequisitionsForApproval({ limit: 25 });
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

  return { rows, status, error, reload };
}
