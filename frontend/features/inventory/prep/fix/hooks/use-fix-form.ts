'use client';

import * as React from 'react';

import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import { isPositive } from '../../_shared/lib/prep-format';
import { prepApi } from '../../_shared/services/prep-api';
import type { CheckResult, CorrectReason, RunDetail } from '../../_shared/types/prep-contract';
import { newIdempotencyKey } from '../../record/hooks/use-record-form';
import { fixFailure, hasChanges, linesFromRun, type FixFailure, type FixLine } from '../lib/fix-logic';

const CHECK_DELAY_MS = 300;

/**
 * The correct-a-run form: the recorded run's lines and made figure as the starting point, the reason, the live yield check
 * (debounced; a failure only hides the guide) and the one write. The idempotency key is made once per form, so a double tap on
 * "Save correction" makes one new run; a failed save keeps everything the person entered and the same key.
 */
export function useFixForm(run: RunDetail) {
  const [lines, setLines] = React.useState<FixLine[]>(() => linesFromRun(run));
  const [made, setMade] = React.useState(run.made);
  const [reason, setReason] = React.useState<CorrectReason | undefined>();
  const [note, setNote] = React.useState('');
  const [check, setCheck] = React.useState<CheckResult | null>(null);
  const [checkFailed, setCheckFailed] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [failure, setFailure] = React.useState<FixFailure | null>(null);
  const keyRef = React.useRef(newIdempotencyKey());
  const inFlight = React.useRef(false);

  const usable = React.useMemo(() => lines.filter((l) => isPositive(l.quantity)), [lines]);
  const madePositive = isPositive(made);
  const changed = hasChanges(run, lines, made);

  // The live check: latest answer wins; the body is a string so the effect depends on a value, not a new object each render.
  const checkBody = usable.length > 0 ? JSON.stringify({ outputItemId: run.outputItemId, inputs: usable.map((l) => ({ itemId: l.itemId, quantity: l.quantity })), made: madePositive ? made : undefined }) : null;
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

  const setQuantity = React.useCallback((itemId: string, quantity: string) => setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, quantity } : l))), []);
  const addLine = React.useCallback((line: Pick<FixLine, 'itemId' | 'name' | 'unit'>) => {
    setLines((prev) => (prev.some((l) => l.itemId === line.itemId) ? prev : [...prev, { ...line, quantity: '1', was: null }]));
  }, []);
  const removeLine = React.useCallback((itemId: string) => setLines((prev) => prev.filter((l) => l.itemId !== itemId)), []);

  const reasonMissing = reason === undefined;
  /** Why "Review the correction" is off, in the kit's words; null when it can go ahead. */
  const blocker = !changed ? PREP_STATES_COPY.fix.needChange : usable.length === 0 || !madePositive ? 'Every amount must be more than zero.' : reasonMissing ? PREP_STATES_COPY.fix.needReason : null;

  const submit = React.useCallback(async (): Promise<RunDetail | null> => {
    if (blocker !== null || reason === undefined || inFlight.current) return null;
    inFlight.current = true;
    setSaving(true);
    setFailure(null);
    try {
      const trimmed = note.trim();
      return await prepApi.correctRun(run.id, {
        idempotencyKey: keyRef.current,
        inputs: usable.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
        made,
        reason,
        ...(trimmed && reason === 'OTHER' ? { reasonNote: trimmed } : {}),
      });
    } catch (err) {
      setFailure(fixFailure(err, PREP_STATES_COPY.fix.correctFailed));
      return null;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [blocker, reason, note, run.id, usable, made]);

  return {
    lines,
    made,
    setMade,
    setQuantity,
    addLine,
    removeLine,
    reason,
    setReason,
    note,
    setNote,
    check,
    checkFailed,
    changed,
    blocker,
    saving,
    failure,
    clearFailure: React.useCallback(() => setFailure(null), []),
    submit,
  };
}

export type FixForm = ReturnType<typeof useFixForm>;
