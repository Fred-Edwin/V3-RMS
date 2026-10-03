import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { getTodaysCount, saveCountLines, submitCount } from '../services/count-api-service';
import type { AttendantCountView } from '../types/count';
import { useResource } from '../../stock/hooks/use-stock';

const AUTOSAVE_DELAY_MS = 700;

/** Keep only what a count figure can be while typing: digits and one decimal point. */
export function sanitizeCountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  return dot === -1 ? cleaned : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '');
}

/** "" / "." → not counted; ".5" → "0.5"; "12." → "12". */
export function normalizeCount(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '.') return null;
  const n = trimmed.startsWith('.') ? `0${trimmed}` : trimmed;
  return n.endsWith('.') ? n.slice(0, -1) : n;
}

export type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: string } | { kind: 'error' };

/**
 * The attendant's daily count. The server holds the truth; this keeps what
 * has been typed in a local `draft` (so typing never waits on the network),
 * autosaves changed lines after a short pause (server-side partial save —
 * no offline queue, plan §7 #6), and computes the live "8/24" counters from
 * the draft. Rapid typing updates state inside `setState` updaters, and a
 * line is only marked saved if it has not changed again since it was sent.
 */
export function useDailyCount() {
  const load = useResource<AttendantCountView>('daily-count', getTodaysCount, "Couldn't load today's count sheet.");
  const view = load.data;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const dirty = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const inflight = useRef<Promise<void> | null>(null);
  const seededFor = useRef<string | null>(null);

  // Seed the draft from the server once per (count, status) — a reload after
  // submit / return re-seeds, a background refetch never clobbers typing.
  useEffect(() => {
    if (!view) return;
    const key = `${view.id}:${view.status}`;
    if (seededFor.current === key) return;
    seededFor.current = key;
    dirty.current = new Set();
    setDraft(Object.fromEntries(view.lines.filter((l) => l.countedQty !== null).map((l) => [l.inventoryItemId, l.countedQty as string])));
    setSaveState(view.status === 'DRAFT' && view.savedAt && view.totals.counted > 0 ? { kind: 'saved', at: view.savedAt } : { kind: 'idle' });
  }, [view]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inflight.current) await inflight.current;
    const countId = view?.id;
    if (!countId || dirty.current.size === 0) return true;
    const ids = Array.from(dirty.current);
    const sent = new Map(ids.map((id) => [id, draftRef.current[id]]));
    const run = (async () => {
      setSaveState({ kind: 'saving' });
      try {
        const result = await saveCountLines(countId, {
          lines: ids.map((id) => ({ inventoryItemId: id, countedQty: normalizeCount(sent.get(id)) })),
        });
        for (const id of ids) {
          // Changed again while in flight → still dirty, saved on the next pass.
          if (draftRef.current[id] === sent.get(id)) dirty.current.delete(id);
        }
        setSaveState({ kind: 'saved', at: result.savedAt });
      } catch {
        setSaveState({ kind: 'error' });
        throw new Error('save failed');
      }
    })();
    inflight.current = run.catch(() => undefined).finally(() => {
      inflight.current = null;
    });
    try {
      await run;
      return dirty.current.size === 0 ? true : flush();
    } catch {
      return false;
    }
  }, [view?.id]);

  const setValue = useCallback(
    (inventoryItemId: string, raw: string) => {
      const value = sanitizeCountInput(raw);
      setDraft((prev) => (prev[inventoryItemId] === value ? prev : { ...prev, [inventoryItemId]: value }));
      dirty.current.add(inventoryItemId);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    },
    [flush],
  );

  // Never lose typing on the way out: flush on unmount and when the tab hides.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      void flush();
    };
  }, [flush]);

  const isCounted = useCallback((id: string) => normalizeCount(draft[id]) !== null, [draft]);

  const progress = useMemo(() => {
    if (!view) return { counted: 0, total: 0, byCategory: new Map<string, { counted: number; total: number }>() };
    if (view.status === 'RETURNED') {
      const counted = view.lines.filter((l) => normalizeCount(draft[l.inventoryItemId]) !== null).length;
      return { counted, total: view.lines.length, byCategory: new Map<string, { counted: number; total: number }>() };
    }
    const byCategory = new Map<string, { counted: number; total: number }>();
    let counted = 0;
    for (const line of view.lines) {
      const key = line.categoryId ?? 'none';
      const entry = byCategory.get(key) ?? { counted: 0, total: 0 };
      entry.total += 1;
      if (normalizeCount(draft[line.inventoryItemId]) !== null) {
        entry.counted += 1;
        counted += 1;
      }
      byCategory.set(key, entry);
    }
    return { counted, total: view.lines.length, byCategory };
  }, [view, draft]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{ kind: 'pin' | 'other'; message: string } | null>(null);

  /** Flush pending edits, then sign. Returns true on success (view reloads to SUBMITTED). */
  const submit = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!view) return false;
      setSubmitting(true);
      setSubmitError(null);
      try {
        const saved = await flush();
        if (!saved) {
          setSubmitError({ kind: 'other', message: "Couldn't save — your counts are kept" });
          return false;
        }
        await submitCount(view.id, pin);
        await load.reload();
        return true;
      } catch (err) {
        const message = formatApiErrorMessage(err, "Couldn't sign the count — try again");
        setSubmitError({ kind: /pin/i.test(message) ? 'pin' : 'other', message });
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [view, flush, load],
  );

  return {
    view,
    status: load.status,
    error: load.error,
    reload: load.reload,
    draft,
    setValue,
    isCounted,
    progress,
    saveState,
    retrySave: flush,
    submit,
    submitting,
    submitError,
    clearSubmitError: useCallback(() => setSubmitError(null), []),
  };
}
