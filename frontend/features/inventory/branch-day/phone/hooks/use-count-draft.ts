import * as React from 'react';

import { scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { BRANCH_DAY_ERROR_COPY, BRANCH_DAY_STATES_COPY } from '../../_shared/lib/branch-day-copy';
import type { CountView } from '../../_shared/types/branch-day-contract';
import { changedLines, cleanFigure, typedFrom } from '../lib/count-logic';
import { branchDayPhoneApi } from '../services/branch-day-phone-api';

const SAVE_AFTER_MS = 600;

/**
 * The figures being typed on B3 and B3c, saved to the server a moment after typing stops (BD7, last write wins) and before the
 * person leaves the step. A failed save keeps every figure on screen and says so; the next change or "Try again" saves again.
 * `serverBlank` is what the server last held, so a change is only sent once.
 */
export function useCountDraft(view: CountView | null) {
  const [typed, setTyped] = React.useState<Record<string, string>>({});
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const typedRef = React.useRef(typed);
  const savedRef = React.useRef<Record<string, string>>({});
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedFor = React.useRef<string | null>(null);
  const inflight = React.useRef<Promise<boolean> | null>(null);

  // Take the server's figures once per load of the view; typing after that is ours.
  React.useEffect(() => {
    if (!view || loadedFor.current === view.day.id) return;
    loadedFor.current = view.day.id;
    const from = typedFrom(view.lines);
    savedRef.current = { ...from };
    typedRef.current = from;
    setTyped(from);
    setReady(true);
  }, [view]);

  const flush = React.useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inflight.current) await inflight.current;
    const lines = changedLines(typedRef.current, savedRef.current);
    if (lines.length === 0) return true;
    setSaving(true);
    const sent = { ...typedRef.current };
    const run = branchDayPhoneApi
      .saveCount({ lines })
      .then(() => {
        savedRef.current = sent;
        setSaveError(null);
        return true;
      })
      .catch((err: unknown) => {
        setSaveError(scwErrorMessage(err, BRANCH_DAY_ERROR_COPY, BRANCH_DAY_STATES_COPY.count.error));
        return false;
      })
      .finally(() => {
        inflight.current = null;
        setSaving(false);
      });
    inflight.current = run;
    return run;
  }, []);

  const setFigure = React.useCallback(
    (itemId: string, raw: string) => {
      const next = { ...typedRef.current, [itemId]: cleanFigure(raw) };
      typedRef.current = next;
      setTyped(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_AFTER_MS);
    },
    [flush],
  );

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { typed, setFigure, flush, saveError, saving, ready, savedRef };
}
