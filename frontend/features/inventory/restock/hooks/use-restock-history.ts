import { useCallback, useEffect, useRef, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { listRestockHistory, putBackRestockLevel } from '../../services';
import type { RestockHistoryEntry, RestockScopeQuery } from '../../types';

export interface RestockHistoryTarget extends RestockScopeQuery {
  /** One item's history; omitted for the location's recent changes. */
  inventoryItemId?: string;
}

/**
 * Restock level history for the drawer: one item's, or the location's recent ones. Loads when
 * `target` is set (the drawer is open); only the latest request writes state. `putBack` adds a
 * new entry on the server, so the list is read again afterwards.
 */
export function useRestockHistory(target: RestockHistoryTarget | null) {
  const [entries, setEntries] = useState<RestockHistoryEntry[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [puttingBackId, setPuttingBackId] = useState<string | null>(null);
  const [putBackError, setPutBackError] = useState<string | null>(null);
  const latest = useRef(0);

  const { locationId, scope, branchId, inventoryItemId } = target ?? {};
  const open = target !== null;

  const load = useCallback(async () => {
    const request = ++latest.current;
    setStatus('loading');
    setError(null);
    try {
      const list = await listRestockHistory({ locationId, scope, branchId, inventoryItemId, limit: 100 });
      if (request !== latest.current) return;
      setEntries(list);
      setStatus('ready');
    } catch (err) {
      if (request !== latest.current) return;
      setError(formatApiErrorMessage(err, 'Could not load the change history.'));
      setStatus('error');
    }
  }, [locationId, scope, branchId, inventoryItemId]);

  useEffect(() => {
    if (!open) {
      latest.current += 1;
      setEntries([]);
      setStatus('idle');
      setError(null);
      setPutBackError(null);
      return;
    }
    void load();
  }, [open, load]);

  const putBack = useCallback(
    async (changeId: string): Promise<RestockHistoryEntry | null> => {
      setPuttingBackId(changeId);
      setPutBackError(null);
      try {
        const entry = await putBackRestockLevel(changeId);
        await load();
        return entry;
      } catch (err) {
        // 409 "already at that level" and 400 "nothing to put back" say what to do; show them as they come.
        setPutBackError(formatApiErrorMessage(err, 'Could not put that level back.'));
        return null;
      } finally {
        setPuttingBackId(null);
      }
    },
    [load]
  );

  const dismissPutBackError = useCallback(() => setPutBackError(null), []);

  return { entries, status, error, reload: load, putBack, puttingBackId, putBackError, dismissPutBackError };
}
