import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { getRestockLevelsSummary, listRestockLevels, saveRestockLevels } from '../services';
import type { RestockLevelRow, RestockLevelsSummary, RestockScope } from '../types';
import { levelNumber, parseLevelInput } from '../lib/restock-logic';

/** Whose levels the page shows: the Central Store, or a department at one branch. */
export interface RestockWhose {
  scope: RestockScope;
  branchId: string | null;
}

/** One level the user changed: the row as it is on file, and the level it would become. */
export interface RestockChange {
  row: RestockLevelRow;
  before: number | null;
  /** `null` clears the level. */
  next: number | null;
  /** The level as the API takes it (a decimal string), or `null` to clear. */
  nextText: string | null;
}

type Load = 'idle' | 'loading' | 'error' | 'ready';

/**
 * The Restock levels page's data: the rows for one "whose levels", the strip, and the unsaved edits.
 *
 * Edits are the text typed in each row's field, kept as typed (so "12." survives); what they change is
 * worked out from them, so typing the saved level back is no change. Nothing is sent until `save`, which
 * sends only the changed levels in one PUT. Rows are read again with the debounced `search`; edits for
 * rows outside the search stay, and the review dialog still names them (rows seen are remembered).
 * Only the latest request writes state.
 */
export function useRestockLevelsPage(whose: RestockWhose, search: string, enabled = true) {
  const { scope, branchId } = whose;
  const needsBranch = scope !== 'CENTRAL_STORE';
  const ready = enabled && (!needsBranch || branchId !== null);
  const whoseKey = `${scope}:${branchId ?? ''}`;

  const [rows, setRows] = useState<RestockLevelRow[]>([]);
  const [summary, setSummary] = useState<RestockLevelsSummary | null>(null);
  const [status, setStatus] = useState<Load>('idle');
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const seen = useRef(new Map<string, RestockLevelRow>());
  const rowsRequest = useRef(0);
  const summaryRequest = useRef(0);

  const scopeQuery = useMemo(() => ({ scope, branchId: needsBranch ? (branchId ?? undefined) : undefined }), [scope, branchId, needsBranch]);

  const loadRows = useCallback(async () => {
    const request = ++rowsRequest.current;
    setStatus('loading');
    setError(null);
    try {
      const list = await listRestockLevels({ ...scopeQuery, search: search || undefined });
      if (request !== rowsRequest.current) return;
      for (const row of list) seen.current.set(row.inventoryItemId, row);
      setRows(list);
      setStatus('ready');
    } catch (err) {
      if (request !== rowsRequest.current) return;
      setError(formatApiErrorMessage(err, 'Could not load restock levels.'));
      setStatus('error');
    }
  }, [scopeQuery, search]);

  const loadSummary = useCallback(async () => {
    const request = ++summaryRequest.current;
    try {
      const next = await getRestockLevelsSummary(scopeQuery);
      if (request === summaryRequest.current) setSummary(next);
    } catch {
      // The strip is a convenience over the list; the list's own error covers a dead connection.
      if (request === summaryRequest.current) setSummary(null);
    }
  }, [scopeQuery]);

  // A different "whose levels" starts clean: the screen has already asked about unsaved edits.
  useEffect(() => {
    seen.current = new Map();
    setEdits({});
    setSaveError(null);
    setRows([]);
    setSummary(null);
  }, [whoseKey]);

  useEffect(() => {
    if (ready) void loadRows();
    else {
      rowsRequest.current += 1;
      setStatus('idle');
    }
  }, [ready, loadRows]);

  useEffect(() => {
    if (ready) void loadSummary();
  }, [ready, loadSummary]);

  const setLevelText = useCallback((inventoryItemId: string, text: string) => {
    setEdits((prev) => ({ ...prev, [inventoryItemId]: text }));
  }, []);

  const discard = useCallback(() => {
    setEdits({});
    setSaveError(null);
  }, []);

  const { changes, invalid } = useMemo(() => {
    const changed: RestockChange[] = [];
    const bad: Record<string, string> = {};
    for (const [id, text] of Object.entries(edits)) {
      const row = seen.current.get(id);
      if (!row) continue;
      const parsed = parseLevelInput(text);
      if (!parsed.ok) {
        bad[id] = parsed.message;
        continue;
      }
      const before = levelNumber(row.level);
      if (parsed.level !== before) changed.push({ row, before, next: parsed.level, nextText: parsed.text });
    }
    // The order they appear in the list, so the review reads like the page.
    const order = new Map(rows.map((r, i) => [r.inventoryItemId, i]));
    changed.sort((a, b) => (order.get(a.row.inventoryItemId) ?? 1e9) - (order.get(b.row.inventoryItemId) ?? 1e9) || a.row.itemName.localeCompare(b.row.itemName));
    return { changes: changed, invalid: bad };
  }, [edits, rows]);

  const save = useCallback(
    async (reason: string): Promise<boolean> => {
      if (changes.length === 0) return true;
      setSaving(true);
      setSaveError(null);
      try {
        await saveRestockLevels({
          ...scopeQuery,
          reason: reason.trim() || undefined,
          levels: changes.map((c) => ({ inventoryItemId: c.row.inventoryItemId, level: c.nextText })),
        });
        setEdits({});
        await Promise.all([loadRows(), loadSummary()]);
        return true;
      } catch (err) {
        setSaveError(formatApiErrorMessage(err, 'Could not save restock levels.'));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [changes, scopeQuery, loadRows, loadSummary]
  );

  /** Read the rows and the strip again, e.g. after a put back changed a level. */
  const refresh = useCallback(async () => {
    await Promise.all([loadRows(), loadSummary()]);
  }, [loadRows, loadSummary]);

  const dismissSaveError = useCallback(() => setSaveError(null), []);

  const dirty = changes.length > 0 || Object.keys(invalid).length > 0;

  return {
    rows,
    summary,
    status,
    error,
    reload: loadRows,
    refresh,
    edits,
    setLevelText,
    changes,
    invalid,
    dirty,
    discard,
    save,
    saving,
    saveError,
    dismissSaveError,
  };
}
