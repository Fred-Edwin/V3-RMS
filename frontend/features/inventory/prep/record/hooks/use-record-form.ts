'use client';

import * as React from 'react';

import { ApiError, formatApiErrorMessage } from '@/types/api';
import { getItem } from '../../../catalog/services/inventory-api-service';
import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import { formatQuantity, isPositive } from '../../_shared/lib/prep-format';
import { prepApi } from '../../_shared/services/prep-api';
import type { CheckResult, OutputsResponse, RunDetail, YieldReason } from '../../_shared/types/prep-contract';

export type OutputOption = OutputsResponse['items'][number];

export interface FormLine {
  itemId: string;
  name: string;
  unit: string;
  quantity: string;
  /** What it was last time, for "Was 10 kg last time". Null for a line added now. */
  was: string | null;
}

/** A fresh UUID for the idempotency key (the form makes one when it opens; a double tap sends the same one). */
export const newIdempotencyKey = (): string => {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const CHECK_DELAY_MS = 300;

export interface UseRecordFormArgs {
  /** The output to record, or undefined while the person is still choosing it. */
  outputItemId: string | undefined;
  outputs: OutputOption[] | null;
}

/**
 * The record-a-run form: lines pre-filled "as last time", the live yield check (debounced, never blocking), the reason chip, and
 * the one write. The idempotency key is made once per form, so a double tap on Confirm records one run.
 */
export function useRecordForm({ outputItemId, outputs }: UseRecordFormArgs) {
  const output = React.useMemo(() => outputs?.find((o) => o.itemId === outputItemId) ?? null, [outputs, outputItemId]);

  const [lines, setLines] = React.useState<FormLine[]>([]);
  const [made, setMade] = React.useState('0');
  const [linesLoading, setLinesLoading] = React.useState(false);
  const [yieldReason, setYieldReason] = React.useState<YieldReason | undefined>();
  const [check, setCheck] = React.useState<CheckResult | null>(null);
  const [checkFailed, setCheckFailed] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [recorded, setRecorded] = React.useState<RunDetail | null>(null);
  const keyRef = React.useRef(newIdempotencyKey());

  // Fill the form "as last time" when the output is known. Ingredient names and units come from the catalog (the outputs list carries ids and amounts only).
  const outputKey = output?.itemId ?? null;
  React.useEffect(() => {
    let cancelled = false;
    setCheck(null);
    setYieldReason(undefined);
    setSaveError(null);
    setRecorded(null);
    keyRef.current = newIdempotencyKey();
    if (!output) {
      setLines([]);
      setMade('0');
      return;
    }
    setMade(output.lastRun ? output.lastRun.made : '0');
    if (!output.lastRun) {
      setLines([]);
      return;
    }
    const last = output.lastRun;
    setLinesLoading(true);
    void Promise.all(last.inputs.map((l) => getItem(l.itemId).then((item) => ({ item, quantity: l.quantity })).catch(() => null))).then((rows) => {
      if (cancelled) return;
      setLines(
        rows.flatMap((row) => (row ? [{ itemId: row.item.id, name: row.item.name, unit: row.item.usageUnit, quantity: row.quantity, was: row.quantity } satisfies FormLine] : []))
      );
      setLinesLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // `output` is identified by its id: a refreshed outputs list must not wipe what the person already changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputKey]);

  const usable = React.useMemo(() => lines.filter((l) => isPositive(l.quantity)), [lines]);
  const madeNumber = isPositive(made);

  // The live check: debounced, latest answer wins, and a failure only hides the guide.
  const checkInputs = React.useMemo(() => usable.map((l) => ({ itemId: l.itemId, quantity: l.quantity })), [usable]);
  const checkBody = outputKey && checkInputs.length > 0 ? JSON.stringify({ outputItemId: outputKey, inputs: checkInputs, made: madeNumber ? made : undefined }) : null;
  React.useEffect(() => {
    if (!checkBody) {
      setCheck(null);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      prepApi
        .check(JSON.parse(checkBody))
        .then((result) => {
          if (stale) return;
          setCheck(result);
          setCheckFailed(false);
        })
        .catch(() => {
          if (!stale) setCheckFailed(true);
        });
    }, CHECK_DELAY_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [checkBody]);

  const setQuantity = React.useCallback((itemId: string, quantity: string) => {
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, quantity } : l)));
  }, []);
  const addLine = React.useCallback((line: Omit<FormLine, 'was' | 'quantity'>) => {
    setLines((prev) => (prev.some((l) => l.itemId === line.itemId) ? prev : [...prev, { ...line, quantity: '1', was: null }]));
  }, []);
  const removeLine = React.useCallback((itemId: string) => setLines((prev) => prev.filter((l) => l.itemId !== itemId)), []);
  const changeMade = React.useCallback((next: string) => setMade(next), []);

  const canReview = Boolean(output) && usable.length > 0 && madeNumber && !linesLoading;

  const record = React.useCallback(async (): Promise<RunDetail | null> => {
    if (!output || !canReview || saving) return null;
    setSaving(true);
    setSaveError(null);
    try {
      const run = await prepApi.record({
        idempotencyKey: keyRef.current,
        outputItemId: output.itemId,
        inputs: usable.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
        made,
        ...(yieldReason ? { yieldReason } : {}),
      });
      setRecorded(run);
      return run;
    } catch (err) {
      setSaveError(err instanceof ApiError && err.statusCode >= 500 ? PREP_STATES_COPY.record.saveFailed : formatApiErrorMessage(err, PREP_STATES_COPY.record.saveFailed));
      return null;
    } finally {
      setSaving(false);
    }
  }, [output, canReview, saving, usable, made, yieldReason]);

  /** Start over for the same output ("Prep this again"): a new key, last time's amounts. */
  const reset = React.useCallback(() => {
    keyRef.current = newIdempotencyKey();
    setRecorded(null);
    setSaveError(null);
    setYieldReason(undefined);
    if (output?.lastRun) setMade(output.lastRun.made);
    setLines((prev) => prev.map((l) => ({ ...l, quantity: l.was ?? l.quantity })));
  }, [output]);

  return {
    output,
    lines,
    linesLoading,
    made,
    changeMade,
    setQuantity,
    addLine,
    removeLine,
    check,
    checkFailed,
    yieldReason,
    setYieldReason,
    canReview,
    saving,
    saveError,
    clearSaveError: () => setSaveError(null),
    record,
    recorded,
    reset,
    madeLabel: formatQuantity(made),
  };
}
