'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import { useCountAutosave } from '../../_shared/hooks/use-count-autosave';
import { appendDigit, showQty } from '../../_shared/lib/count-format';
import { countingApi } from '../../_shared/services/counting-api';
import type { CheckResult, CountDetail } from '../../_shared/types/counting-contract';

export interface ShelfLine {
  id: string;
  itemId: string;
  name: string;
  unit: string;
  sectionId: string | null;
  sectionName: string | null;
  /** The committed number as text ("" = none yet). */
  counted: string;
  skipped: boolean;
  recheck: 'NONE' | 'RECOUNTED' | 'KEPT';
  /** The number first typed, kept while a recount replaces it. */
  first: string;
}

const toLine = (l: CountDetail['lines'][number]): ShelfLine => ({
  id: l.id,
  itemId: l.itemId,
  name: l.itemName,
  unit: l.unit,
  sectionId: l.sectionId,
  sectionName: l.sectionName,
  counted: showQty(l.countedQty),
  skipped: l.skipped,
  recheck: l.recheck,
  first: showQty(l.firstCountedQty),
});

export type ShelfMode = { kind: 'count' } | { kind: 'recount'; queue: string[]; index: number };

export interface ShelfApi {
  lines: ShelfLine[];
  activeId: string | null;
  draft: string;
  mode: ShelfMode;
  progress: { total: number; counted: number; skipped: number };
  /** The section of the active line, 1-based, and how many sections the count has. */
  sectionPosition: { index: number; of: number };
  autosave: ReturnType<typeof useCountAutosave>;
  /** The items the section-end check offered, while the sheet is open. */
  check: { items: CheckResult['items']; text: string } | null;
  checking: boolean;
  checkFailed: boolean;
  /** True when every line has a number or a skip and nothing is left to do. */
  finished: boolean;
  type: (digit: string) => void;
  backspace: () => void;
  /** Next (a number is typed) or Skip (the box is empty): save the line and move on. */
  advance: () => Promise<void>;
  select: (lineId: string) => void;
  startRecount: () => void;
  continueAsCounted: () => void;
  dismissCheck: () => void;
  retryCheck: () => Promise<void>;
  /** After the check or the end of the list: where to go next (the screen decides). */
  ended: boolean;
}

/**
 * The Attendant's count in progress (Paper steps 2 to 4): which row is being counted, the number being typed, quiet autosave,
 * and the once-only section-end check and recount. The server is the source of truth for the count; this holds only what is on
 * the device until it is saved (a failed save keeps the number and offers Try again).
 */
export function useShelf(initial: CountDetail, focusLineId?: string | null): ShelfApi {
  const [lines, setLines] = useState<ShelfLine[]>(() => [...initial.lines].sort((a, b) => a.position - b.position).map(toLine));
  // `?line=` (from Review before signing, to change a number) opens that line; otherwise the first line still to do.
  const [activeId, setActiveId] = useState<string | null>(() => lines.find((l) => l.id === focusLineId)?.id ?? lines.find((l) => l.counted === '' && !l.skipped)?.id ?? null);
  const [draft, setDraft] = useState(() => lines.find((l) => l.id === focusLineId)?.counted ?? '');
  const [mode, setMode] = useState<ShelfMode>({ kind: 'count' });
  const [check, setCheck] = useState<{ items: CheckResult['items']; text: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [ended, setEnded] = useState(false);
  const checkedSections = useRef(new Set<string>());
  const pendingSection = useRef<string | null>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const autosave = useCountAutosave(initial.id, undefined, initial.savedAt);

  const sectionIds = useMemo(() => Array.from(new Set(lines.map((l) => l.sectionId ?? ''))), [lines]);
  const progress = useMemo(
    () => ({ total: lines.length, counted: lines.filter((l) => l.counted !== '').length, skipped: lines.filter((l) => l.skipped).length }),
    [lines],
  );
  const active = lines.find((l) => l.id === activeId) ?? null;
  const sectionPosition = { index: Math.max(0, sectionIds.indexOf(active?.sectionId ?? sectionIds[0] ?? '')) + 1, of: Math.max(1, sectionIds.length) };

  const focusLine = useCallback((id: string | null, text = ''): void => {
    setActiveId(id);
    setDraft(text);
  }, []);

  const nextUnhandledAfter = useCallback((id: string | null): string | null => {
    const all = linesRef.current;
    const from = id ? all.findIndex((l) => l.id === id) : -1;
    const ordered = [...all.slice(from + 1), ...all.slice(0, Math.max(0, from))];
    return ordered.find((l) => l.counted === '' && !l.skipped && l.id !== id)?.id ?? null;
  }, []);

  const finishSection = useCallback(
    async (sectionId: string, nextId: string | null): Promise<void> => {
      // The server judges this section's numbers against the Manager's range and answers with names and typed numbers only.
      if (checkedSections.current.has(sectionId)) {
        if (nextId) focusLine(nextId);
        else setEnded(true);
        return;
      }
      setChecking(true);
      setCheckFailed(false);
      pendingSection.current = sectionId;
      const saved = await autosave.flush();
      if (!saved) {
        setChecking(false);
        setCheckFailed(true);
        return;
      }
      try {
        const result = await countingApi.check(initial.id, sectionId);
        checkedSections.current.add(sectionId);
        setChecking(false);
        if (result.items.length > 0) {
          setCheck({ items: result.items, text: result.text });
          return;
        }
        if (nextId) focusLine(nextId);
        else setEnded(true);
      } catch {
        // "Could not check this section. Carry on or try again."
        setChecking(false);
        setCheckFailed(true);
      }
    },
    [autosave, initial.id, focusLine],
  );

  const commit = useCallback(
    async (line: ShelfLine, text: string, skip: boolean): Promise<void> => {
      const recounting = mode.kind === 'recount';
      const kept = recounting && text === '';
      const value = kept ? line.counted : text;
      const updated: ShelfLine = {
        ...line,
        counted: skip && !recounting ? '' : value,
        skipped: skip && !recounting,
        recheck: recounting ? (kept ? 'KEPT' : 'RECOUNTED') : line.recheck,
        first: recounting && !kept ? line.counted : line.first,
      };
      setLines((all) => all.map((l) => (l.id === line.id ? updated : l)));
      linesRef.current = linesRef.current.map((l) => (l.id === line.id ? updated : l));
      autosave.save({
        lineId: line.id,
        countedQty: skip && !recounting ? null : value === '' ? null : value,
        skipped: skip && !recounting,
        ...(recounting ? { recheck: kept ? ('KEPT' as const) : ('RECOUNTED' as const) } : {}),
      });
      if (recounting) {
        const nextIndex = mode.index + 1;
        const nextId = mode.queue[nextIndex];
        if (nextId) {
          setMode({ kind: 'recount', queue: mode.queue, index: nextIndex });
          focusLine(nextId);
        } else {
          setMode({ kind: 'count' });
          const after = nextUnhandledAfter(null);
          if (after) focusLine(after);
          else {
            focusLine(null);
            setEnded(true);
          }
        }
        return;
      }
      const nextId = nextUnhandledAfter(line.id);
      const sectionDone = !linesRef.current.some((l) => l.sectionId === line.sectionId && l.counted === '' && !l.skipped);
      if (sectionDone) {
        focusLine(null);
        await finishSection(line.sectionId ?? '', nextId);
      } else {
        focusLine(nextId);
      }
    },
    [mode, autosave, focusLine, nextUnhandledAfter, finishSection],
  );

  const advance = useCallback(async (): Promise<void> => {
    if (!active) return;
    await commit(active, draft, draft === '');
  }, [active, draft, commit]);

  const select = useCallback(
    (lineId: string): void => {
      if (mode.kind === 'recount') return;
      const line = linesRef.current.find((l) => l.id === lineId);
      if (!line) return;
      focusLine(lineId, line.counted);
    },
    [mode, focusLine],
  );

  const startRecount = useCallback((): void => {
    if (!check) return;
    const queue = check.items.map((i) => i.lineId);
    setCheck(null);
    setMode({ kind: 'recount', queue, index: 0 });
    focusLine(queue[0] ?? null);
  }, [check, focusLine]);

  const continueAsCounted = useCallback((): void => {
    setCheck(null);
    const after = nextUnhandledAfter(null);
    if (after) focusLine(after);
    else setEnded(true);
  }, [focusLine, nextUnhandledAfter]);

  const retryCheck = useCallback(async (): Promise<void> => {
    const section = pendingSection.current;
    if (!section) return;
    await finishSection(section, nextUnhandledAfter(null));
  }, [finishSection, nextUnhandledAfter]);

  return {
    lines,
    activeId,
    draft,
    mode,
    progress,
    sectionPosition,
    autosave,
    check,
    checking,
    checkFailed,
    finished: progress.counted + progress.skipped >= progress.total && progress.total > 0,
    type: (digit) => setDraft((d) => appendDigit(d, digit)),
    backspace: () => setDraft((d) => d.slice(0, -1)),
    advance,
    select,
    startRecount,
    continueAsCounted,
    dismissCheck: continueAsCounted,
    retryCheck,
    ended,
  };
}
