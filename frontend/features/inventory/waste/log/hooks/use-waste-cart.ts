'use client';

import { useCallback, useState } from 'react';

import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { WASTE_ERROR_COPY, WASTE_STATES_COPY } from '../../_shared/lib/states-copy';
import { wasteApi } from '../../_shared/services/waste-api';
import type { LogWasteResult, WasteItemOption, WasteReason } from '../../_shared/types/waste-contract';

export interface CartLine {
  item: WasteItemOption;
  quantity: string;
  reason: WasteReason;
}

/**
 * The list of items being logged, for both the phone flow and the desktop drawer. One idempotency key is made when the form opens
 * and reused for every submit, so a double tap or Enter twice logs once; it is renewed after a success. A failed log keeps every
 * line the person entered. `confirm` returns the result or null.
 */
export function useWasteCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idem = useIdempotencyKey();

  const upsert = useCallback((line: CartLine): void => {
    setLines((all) => (all.some((l) => l.item.itemId === line.item.itemId) ? all.map((l) => (l.item.itemId === line.item.itemId ? line : l)) : [...all, line]));
  }, []);
  const remove = useCallback((id: string): void => setLines((all) => all.filter((l) => l.item.itemId !== id)), []);
  const reset = useCallback((): void => {
    setLines([]);
    setNote('');
    setError(null);
    idem.renew();
  }, [idem]);

  const confirm = useCallback(async (): Promise<LogWasteResult | null> => {
    if (busy || lines.length === 0) return null;
    setBusy(true);
    setError(null);
    try {
      const result = await wasteApi.log({
        entries: lines.map((l) => ({ inventoryItemId: l.item.itemId, quantity: l.quantity, reason: l.reason })),
        ...(note.trim() ? { note: note.trim() } : {}),
        idempotencyKey: idem.key(),
      });
      idem.renew();
      return result;
    } catch (err) {
      setError(scwErrorMessage(err, WASTE_ERROR_COPY, WASTE_STATES_COPY.logDrawer.error));
      return null;
    } finally {
      setBusy(false);
    }
  }, [busy, lines, note, idem]);

  return { lines, upsert, remove, reset, note, setNote, busy, error, confirm };
}
