'use client';

import { useCallback, useState } from 'react';

import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { BRANCH_WASTE_ERROR_COPY, BRANCH_WASTE_STATES_COPY } from '../../_shared/lib/branch-waste-copy';
import type { LogBranchWasteResult, WasteItemOption, WasteReason } from '../../_shared/types/waste-contract';
import { branchWasteApi } from '../../_shared/services/branch-waste-api';

export interface BranchCartLine {
  item: WasteItemOption;
  quantity: string;
  reason: WasteReason;
}

/** The note a head or member may leave on the batch (G19: a textarea, 200 characters). */
export const NOTE_MAX = 200;

/**
 * The items being logged on the phone (W1 to W3). One idempotency key is made when the form opens and reused for every submit, so a
 * double tap logs once; it is renewed after a success. A failed log keeps every line and the note. `confirm` returns the result or null.
 * A second line for the same item replaces the first (one reason per item, W9).
 */
export function useBranchWasteCart() {
  const [lines, setLines] = useState<BranchCartLine[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idem = useIdempotencyKey();

  const upsert = useCallback((line: BranchCartLine): void => {
    setLines((all) => (all.some((l) => l.item.itemId === line.item.itemId) ? all.map((l) => (l.item.itemId === line.item.itemId ? line : l)) : [...all, line]));
  }, []);
  const remove = useCallback((itemId: string): void => setLines((all) => all.filter((l) => l.item.itemId !== itemId)), []);
  const reset = useCallback((): void => {
    setLines([]);
    setNote('');
    setError(null);
    idem.renew();
  }, [idem]);
  const clearError = useCallback((): void => setError(null), []);

  const confirm = useCallback(async (): Promise<LogBranchWasteResult | null> => {
    if (busy || lines.length === 0) return null;
    setBusy(true);
    setError(null);
    try {
      const result = await branchWasteApi.log({
        entries: lines.map((l) => ({ inventoryItemId: l.item.itemId, quantity: l.quantity, reason: l.reason })),
        ...(note.trim() ? { note: note.trim() } : {}),
        idempotencyKey: idem.key(),
      });
      idem.renew();
      return result;
    } catch (err) {
      setError(scwErrorMessage(err, BRANCH_WASTE_ERROR_COPY, BRANCH_WASTE_STATES_COPY.check.error));
      return null;
    } finally {
      setBusy(false);
    }
  }, [busy, lines, note, idem]);

  return { lines, upsert, remove, reset, note, setNote, busy, error, clearError, confirm };
}
