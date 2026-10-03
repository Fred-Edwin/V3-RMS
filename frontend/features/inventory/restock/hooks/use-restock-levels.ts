import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { listRestockLevels, saveRestockLevels } from '../../services';
import type { RestockLevelRow } from '../../types';

export type RestockLevelsActor = { role: 'STORE_MANAGER' | 'DEPARTMENT_HEAD' };

/**
 * Restock Levels is a bulk-save screen (Central Store and department both):
 * many rows are edited locally, then one "Save restock levels" click submits
 * every dirty row in a single `PUT`. This hook owns that dirty-row map so
 * the screen component only renders rows and calls `setLevel` / `save`.
 */
export function useRestockLevels(locationId: string | undefined, actor: RestockLevelsActor, enabled = true) {
  const [rows, setRows] = useState<RestockLevelRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string | null>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const list = await listRestockLevels({ locationId }, actor);
      setRows(list);
      setEdits({});
      setStatus('ready');
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load restock levels.'));
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, actor.role]);

  // `enabled` lets a drawer mount closed without fetching — and wait for the
  // Central Store id — instead of firing a `locationId`-less request (400).
  useEffect(() => {
    if (enabled) void load();
  }, [load, enabled]);

  const setLevel = useCallback((inventoryItemId: string, value: string | null) => {
    setEdits((prev) => ({ ...prev, [inventoryItemId]: value }));
  }, []);

  /** Drops one typed level so the row shows what is on file again. */
  const revert = useCallback((inventoryItemId: string) => {
    setEdits((prev) => {
      if (!(inventoryItemId in prev)) return prev;
      const rest = { ...prev };
      delete rest[inventoryItemId];
      return rest;
    });
  }, []);

  const displayRows = useMemo(
    () =>
      rows.map((row) =>
        row.inventoryItemId in edits ? { ...row, level: edits[row.inventoryItemId] } : row
      ),
    [rows, edits]
  );

  const changedIds = useMemo(() => Object.keys(edits), [edits]);
  const isDirty = changedIds.length > 0;

  const save = useCallback(async () => {
    if (!isDirty) return true;
    setSaving(true);
    setSaveError(null);
    try {
      const levels = Object.entries(edits).map(([inventoryItemId, level]) => ({ inventoryItemId, level }));
      const updated = await saveRestockLevels({ locationId, levels }, actor);
      setRows(updated);
      setEdits({});
      return true;
    } catch (err) {
      setSaveError(formatApiErrorMessage(err, 'Could not save restock levels.'));
      return false;
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits, isDirty, locationId, actor.role]);

  const discard = useCallback(() => setEdits({}), []);

  return { rows: displayRows, savedRows: rows, changedIds, isDirty, setLevel, revert, save, saving, saveError, discard, status, error, reload: load };
}
