import { useCallback, useMemo, useState } from 'react';

import { ApiError } from '@/types/api';
import { createSpotCount } from '../services/count-api-service';
import type { CountReasonValue, SpotCountResult } from '../types/count';
import type { StockRow } from '../../stock/types/stock';
import { normalizeCount, sanitizeCountInput } from './use-daily-count';

export interface SpotRow {
  itemId: string;
  name: string;
  usageUnit: string;
  expected: string;
  unitCost: string;
  counted: string;
  reason: CountReasonValue | null;
  reasonNote: string | null;
}

/** variance = counted − expected; null until a valid figure is typed. */
export function spotVariance(row: SpotRow): number | null {
  const counted = normalizeCount(row.counted);
  if (counted === null) return null;
  return Number.parseFloat(counted) - Number.parseFloat(row.expected);
}

export function spotNeedsReason(row: SpotRow, thresholdKes: number | null): boolean {
  const variance = spotVariance(row);
  if (variance === null || variance === 0 || thresholdKes === null) return false;
  return Math.abs(variance * Number.parseFloat(row.unitCost)) >= thresholdKes;
}

const reasonMissing = (row: SpotRow): boolean => !row.reason || (row.reason === 'OTHER' && !(row.reasonNote ?? '').trim());

/**
 * The Store Manager's spot count. Rows are held locally until the PIN
 * signature; nothing is written before it. Above-threshold lines (judged
 * against the Central Store threshold the server will use) need a reason.
 */
export function useSpotCount(thresholdKes: number | null) {
  const [rows, setRows] = useState<SpotRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ kind: 'pin' | 'other'; message: string } | null>(null);

  const addItem = useCallback((row: StockRow) => {
    setRows((prev) =>
      prev.some((r) => r.itemId === row.itemId)
        ? prev
        : [...prev, { itemId: row.itemId, name: row.name, usageUnit: row.usageUnit, expected: row.onHand, unitCost: row.currentCost, counted: '', reason: null, reasonNote: null }],
    );
  }, []);
  const removeItem = useCallback((itemId: string) => setRows((prev) => prev.filter((r) => r.itemId !== itemId)), []);
  const setCounted = useCallback((itemId: string, raw: string) => {
    const value = sanitizeCountInput(raw);
    setRows((prev) => prev.map((r) => (r.itemId === itemId ? { ...r, counted: value } : r)));
  }, []);
  const setReason = useCallback((itemId: string, reason: CountReasonValue, note: string | null) => {
    setRows((prev) => prev.map((r) => (r.itemId === itemId ? { ...r, reason, reasonNote: note } : r)));
  }, []);
  const reset = useCallback(() => {
    setRows([]);
    setError(null);
  }, []);

  const counted = useMemo(() => rows.filter((r) => normalizeCount(r.counted) !== null), [rows]);
  const needReason = useMemo(() => counted.filter((r) => spotNeedsReason(r, thresholdKes)), [counted, thresholdKes]);
  const missingReasons = useMemo(() => needReason.filter(reasonMissing), [needReason]);
  const uncounted = rows.length - counted.length;
  const canSign = counted.length > 0 && uncounted === 0 && missingReasons.length === 0 && thresholdKes !== null;

  const submit = useCallback(
    async (pin: string): Promise<SpotCountResult | null> => {
      setSubmitting(true);
      setError(null);
      try {
        const result = await createSpotCount({
          pin,
          lines: counted.map((r) => ({
            inventoryItemId: r.itemId,
            countedQty: normalizeCount(r.counted) as string,
            ...(r.reason ? { reason: r.reason, reasonNote: r.reason === 'OTHER' ? r.reasonNote : null } : {}),
          })),
        });
        return result;
      } catch (err) {
        const wrongPin = err instanceof ApiError && /pin/i.test(err.message);
        setError({ kind: wrongPin ? 'pin' : 'other', message: wrongPin ? 'Incorrect PIN' : "Couldn't save the spot count" });
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [counted],
  );

  return {
    rows,
    addItem,
    removeItem,
    setCounted,
    setReason,
    reset,
    counted,
    needReason,
    missingReasons,
    uncounted,
    canSign,
    submit,
    submitting,
    error,
    clearError: useCallback(() => setError(null), []),
  };
}
