import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useResource } from '@/features/inventory';
import { formatApiErrorMessage } from '@/types/api';
import {
  acceptOpening,
  closeDay,
  getBranchThresholds,
  getDayDetail,
  getDayDocument,
  getDepartment,
  getHistory,
  getOpening,
  getOverview,
  getToday,
  reopenDay,
  saveBranchThresholds,
  saveDepartmentLines,
} from '../services/branch-day-api-service';
import { liveGap, normalizeCount, sanitizeCountInput } from '../lib/branch-day-format';
import type {
  BranchDayDetail,
  BranchDayToday,
  HistoryList,
  OpeningView,
  BranchThresholds,
  DayDocument,
  DepartmentDayDetail,
  DepartmentDaySummary,
  DepartmentLine,
  DepartmentTag,
  GapReasonValue,
} from '../types/branch-day';

const AUTOSAVE_DELAY_MS = 700;

/**
 * Today's day — overview, rail, KPIs. `reload` keeps the previous data on screen (`refreshing`), never flashing skeletons.
 * With a `dayId` it loads that one of the branch's own days instead (a reopened past day), same shape.
 */
export function useBranchDayToday(dayId: string | null = null) {
  const r = useResource<BranchDayToday>(
    dayId ? `branch-day:overview:${dayId}` : 'branch-day:today',
    () => (dayId ? getOverview(dayId) : getToday()),
    "Couldn't load today's day.",
  );
  return { today: r.data, status: r.status, refreshing: r.refreshing, error: r.error, reload: r.reload };
}

/** Closed / reopened / open past days in a date range (Day close history list). */
export function useDayHistory(from: string, to: string) {
  const r = useResource<HistoryList>(`branch-day:history:${from}:${to}`, () => getHistory(from, to), "Couldn't load day close history.");
  return { history: r.data, status: r.status, refreshing: r.refreshing, error: r.error, reload: r.reload };
}

/** One day, read-only: KPIs, every department's saved lines, and the reopen audit trail. */
export function useDayDetail(dayId: string | null) {
  const r = useResource<BranchDayDetail>(dayId ? `branch-day:detail:${dayId}` : null, () => getDayDetail(dayId as string), "Couldn't load this day.");
  return { detail: r.data, status: r.status, refreshing: r.refreshing, error: r.error, reload: r.reload };
}

/** The department head's next-morning opening: live pre-fill until accepted, the signed figures after. */
export function useOpening(enabled = true) {
  const r = useResource<OpeningView>(enabled ? 'branch-day:opening' : null, getOpening, "Couldn't load the opening figures.");
  return { opening: r.data, status: r.status, refreshing: r.refreshing, error: r.error, reload: r.reload };
}

export { acceptOpening };

export function useDayDocument(dayId: string | null) {
  const r = useResource<DayDocument>(dayId ? `branch-day:document:${dayId}` : null, () => getDayDocument(dayId as string), "Couldn't load the signed document.");
  return { doc: r.data, status: r.status, error: r.error, reload: r.reload };
}

/** Loads on open only (the drawer is mounted closed on the day screen). */
export function useBranchThresholds(enabled: boolean) {
  const fetcher = useCallback(() => getBranchThresholds(), []);
  const r = useResource<BranchThresholds>(enabled ? 'branch-thresholds' : null, fetcher, "Couldn't load thresholds.");
  return { thresholds: r.data, status: r.status, reload: r.reload };
}

export { saveBranchThresholds };

export type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: string } | { kind: 'error' };

export interface LineDraft {
  counted: string;
  reason: GapReasonValue | null;
  note: string | null;
}

/**
 * One department's count entry. The server holds the truth; typing lives in
 * a local `draft` (never waits on the network), changed lines autosave after a
 * short pause (server-side partial save — no offline queue, plan §7 #6), the
 * gap and reason requirement recompute live from the draft, and a line is only
 * marked saved if it hasn't changed again since it was sent. A background
 * refetch never clobbers typing (the draft seeds once per day/department).
 */
export function useDepartmentCount(dayId: string | null, tag: DepartmentTag | null, onSaved?: (summary: DepartmentDaySummary) => void) {
  const key = dayId && tag ? `branch-day:${dayId}:${tag}` : null;
  const load = useResource<DepartmentDayDetail>(key, () => getDepartment(dayId as string, tag as DepartmentTag), "Couldn't load this department.");
  const [latest, setLatest] = useState<DepartmentDayDetail | null>(null);
  const detail = latest ?? load.data;

  const [draft, setDraft] = useState<Record<string, LineDraft>>({});
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const dirty = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const inflight = useRef<Promise<void> | null>(null);
  const seededFor = useRef<string | null>(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  // A different department starts clean; a reload replaces the server snapshot.
  useEffect(() => {
    setLatest(null);
  }, [key, load.data]);

  useEffect(() => {
    if (!load.data) return;
    const seedKey = `${key}:${load.data.dayStatus}`;
    if (seededFor.current === seedKey) return;
    seededFor.current = seedKey;
    dirty.current = new Set();
    setDraft(
      Object.fromEntries(
        load.data.lines
          .filter((l) => l.countedQty !== null)
          .map((l) => [l.inventoryItemId, { counted: l.countedQty as string, reason: l.reason, note: l.reasonNote }]),
      ),
    );
    setSaveState({ kind: 'idle' });
  }, [load.data, key]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inflight.current) await inflight.current;
    if (!dayId || !tag || dirty.current.size === 0) return true;
    const ids = Array.from(dirty.current);
    const sent = new Map(ids.map((id) => [id, draftRef.current[id]]));
    const run = (async () => {
      setSaveState({ kind: 'saving' });
      try {
        const result = await saveDepartmentLines(dayId, tag, {
          lines: ids.map((id) => {
            const d = sent.get(id);
            const counted = normalizeCount(d?.counted);
            return { inventoryItemId: id, countedQty: counted, reason: counted === null ? null : (d?.reason ?? null), reasonNote: counted === null ? null : (d?.note ?? null) };
          }),
        });
        for (const id of ids) {
          // Changed again while in flight → still dirty, saved on the next pass.
          if (draftRef.current[id] === sent.get(id)) dirty.current.delete(id);
        }
        setLatest(result.detail);
        setSaveState({ kind: 'saved', at: result.savedAt });
        onSavedRef.current?.(result.detail.summary);
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
  }, [dayId, tag]);

  const schedule = useCallback(
    (delay: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [flush],
  );

  const setCount = useCallback(
    (inventoryItemId: string, raw: string) => {
      const counted = sanitizeCountInput(raw);
      // Compute inside the updater so rapid typing never reads a stale draft.
      setDraft((prev) => {
        const current = prev[inventoryItemId];
        if (current?.counted === counted) return prev;
        return { ...prev, [inventoryItemId]: { counted, reason: current?.reason ?? null, note: current?.note ?? null } };
      });
      dirty.current.add(inventoryItemId);
      schedule(AUTOSAVE_DELAY_MS);
    },
    [schedule],
  );

  const setReason = useCallback(
    (inventoryItemId: string, reason: GapReasonValue, note: string | null) => {
      setDraft((prev) => {
        const current = prev[inventoryItemId];
        if (!current) return prev;
        return { ...prev, [inventoryItemId]: { ...current, reason, note } };
      });
      dirty.current.add(inventoryItemId);
      schedule(150);
    },
    [schedule],
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

  const threshold = detail?.reasonRequiredKes ?? 0;
  const rows = useMemo(() => {
    if (!detail) return [] as { line: DepartmentLine; counted: string | null; live: ReturnType<typeof liveGap>; reason: GapReasonValue | null; note: string | null }[];
    return detail.lines.map((line) => {
      const d = draft[line.inventoryItemId];
      const counted = d ? normalizeCount(d.counted) : line.countedQty;
      const live = liveGap(line, counted, threshold);
      return { line, counted, live, reason: d?.reason ?? line.reason, note: d?.note ?? line.reasonNote };
    });
  }, [detail, draft, threshold]);

  const progress = useMemo(() => {
    const counted = rows.filter((r) => r.counted !== null).length;
    const gaps = rows.filter((r) => r.live.reasonRequired).length;
    const net = rows.reduce((sum, r) => sum + (r.live.value ?? 0), 0);
    const unreasoned = rows.filter((r) => r.live.reasonRequired && !(r.reason && (r.reason !== 'OTHER' || (r.note ?? '').trim()))).length;
    return { counted, total: rows.length, gaps, net, unreasoned };
  }, [rows]);

  return {
    detail,
    status: load.status,
    error: load.error,
    reload: load.reload,
    rows,
    progress,
    setCount,
    setReason,
    saveState,
    retrySave: flush,
    flush,
  };
}

export type DepartmentCountView = ReturnType<typeof useDepartmentCount>;

/**
 * The live count's shape over a day's *saved* lines. History reads what was signed — nothing is typed,
 * autosaved or recomputed — so the same read-only panes render it unchanged (Paper `1CMM-0` matches `19C8-0`).
 */
export function useSavedDepartmentCount(
  day: BranchDayDetail | null,
  tag: DepartmentTag | null,
  status: 'loading' | 'error' | 'ready',
  reload: () => Promise<void>,
): DepartmentCountView {
  return useMemo(() => {
    const entry = day && tag ? day.departments.find((d) => d.summary.tag === tag) : undefined;
    const detail: DepartmentDayDetail | null =
      day && entry
        ? { branchDayId: day.id, date: day.date, dayStatus: day.status, closedAt: day.closedAt, reasonRequiredKes: 0, summary: entry.summary, lines: entry.lines }
        : null;
    const rows = (detail?.lines ?? []).map((line) => {
      const gap = line.gap === null ? null : Number.parseFloat(line.gap);
      return {
        line,
        counted: line.countedQty,
        live: { gap, value: line.gapValue === null ? null : Number.parseFloat(line.gapValue), reasonRequired: line.reasonRequired && gap !== null && gap !== 0 } as ReturnType<typeof liveGap>,
        reason: line.reason,
        note: line.reasonNote,
      };
    });
    const counted = rows.filter((r) => r.counted !== null).length;
    return {
      detail,
      status,
      error: null,
      reload,
      rows,
      progress: {
        counted,
        total: rows.length,
        gaps: rows.filter((r) => r.live.reasonRequired).length,
        net: rows.reduce((sum, r) => sum + (r.live.value ?? 0), 0),
        unreasoned: 0,
      },
      setCount: () => undefined,
      setReason: () => undefined,
      saveState: { kind: 'idle' },
      retrySave: async () => true,
      flush: async () => true,
    };
  }, [day, tag, status, reload]);
}

/** Close (PIN-signed) and reopen (reason) — one place for the in-flight + error state both flows share. */
export function useDayActions(dayId: string | null, onDone: () => void | Promise<void>) {
  const [busy, setBusy] = useState<'close' | 'reopen' | null>(null);
  const [error, setError] = useState<{ kind: 'pin' | 'other'; message: string } | null>(null);

  const close = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!dayId) return false;
      setBusy('close');
      setError(null);
      try {
        await closeDay(dayId, pin);
        await onDone();
        return true;
      } catch (err) {
        const message = formatApiErrorMessage(err, "Couldn't sign — try again");
        setError({ kind: /pin/i.test(message) ? 'pin' : 'other', message });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [dayId, onDone],
  );

  const reopen = useCallback(
    async (reason: string): Promise<boolean> => {
      if (!dayId) return false;
      setBusy('reopen');
      setError(null);
      try {
        await reopenDay(dayId, reason);
        await onDone();
        return true;
      } catch (err) {
        setError({ kind: 'other', message: formatApiErrorMessage(err, "Couldn't reopen the day") });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [dayId, onDone],
  );

  return { busy, error, close, reopen, clearError: useCallback(() => setError(null), []) };
}
