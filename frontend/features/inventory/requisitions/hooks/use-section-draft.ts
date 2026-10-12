import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLoader } from '../../_shared/hooks/use-async';
import type { AddableItem, SectionEdit } from '../_shared/types/requisitions-contract';
import { headErrorMessage, SECTION_COPY } from '../_shared/lib/phone-words';
import { cleanTyped, isValidQty, stepQty, toNumber } from '../lib/qty';
import { requisitionsApi } from '../services/requisitions-phone-api';

/** One line of the head's draft, as the phone edits it. */
export interface DraftLine {
  itemId: string;
  itemName: string;
  unit: string;
  categoryPath: string[];
  /** What the head typed or stepped to; a string so "2." can be typed. */
  qty: string;
  /** What the screen pre-filled; null for a line the head added. */
  suggestedQty: string | null;
  onHand?: string;
  level?: string;
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_MS = 600;

/** The line counts as changed when the head added it or its quantity differs from the suggestion (Amendment 2). */
export const isChanged = (line: DraftLine): boolean => line.suggestedQty === null || toNumber(line.qty) !== toNumber(line.suggestedQty);

/** Lines grouped by category, in the order they first appear. The heading joins a two-level path with " · ". */
export function groupByCategory<T extends { categoryPath: string[] }>(lines: readonly T[]): { heading: string; lines: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const line of lines) {
    const heading = line.categoryPath.join(' · ') || 'Other';
    const list = groups.get(heading);
    if (list) list.push(line);
    else groups.set(heading, [line]);
  }
  return Array.from(groups, ([heading, list]) => ({ heading, lines: list }));
}

/**
 * The head's section draft (steps 2, 3, 4): loads R8 once, then edits locally and saves the whole draft (R12) a moment after the
 * last change. Removed lines are counted on the device until the list is sent (Amendment 2); "Undo" brings the last one back.
 * Every returned function is stable.
 */
export function useSectionDraft(requisitionId: string, departmentId: string) {
  const edit = useLoader<SectionEdit>(`req-section:${requisitionId}:${departmentId}`, () => requisitionsApi.sectionEdit(requisitionId, departmentId), 'Could not open your list.');

  const [lines, setLines] = useState<DraftLine[]>([]);
  const [note, setNoteState] = useState('');
  const [removed, setRemoved] = useState<DraftLine[]>([]);
  const [undo, setUndo] = useState<DraftLine | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const hydrated = useRef(false);
  const [ready, setReady] = useState(false);
  const latest = useRef({ lines, note });
  const dirty = useRef(false);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latest.current = { lines, note };
  }, [lines, note]);

  // Load the server's draft into local state once; later reloads never overwrite what the head is typing.
  const data = edit.data;
  useEffect(() => {
    if (!data || hydrated.current) return;
    hydrated.current = true;
    setReady(true);
    const section = data.section;
    setLines(
      section.lines.map((l) => ({
        itemId: l.itemId,
        itemName: l.itemName,
        unit: l.unit,
        categoryPath: l.categoryPath,
        qty: l.requestedQty,
        suggestedQty: l.suggestedQty,
        onHand: l.onHand,
        level: l.level,
      })),
    );
    setNoteState(section.noteForManager ?? '');
  }, [data]);

  const save = useCallback(async (): Promise<boolean> => {
    if (saving.current) {
      dirty.current = true;
      return true;
    }
    saving.current = true;
    dirty.current = false;
    setSaveState('saving');
    try {
      const { lines: current, note: currentNote } = latest.current;
      await requisitionsApi.saveLines(requisitionId, departmentId, {
        lines: current.filter((l) => isValidQty(l.qty)).map((l) => ({ itemId: l.itemId, requestedQty: l.qty })),
        noteForManager: currentNote.trim() === '' ? null : currentNote.trim(),
      });
      setSaveError(null);
      setSaveState('saved');
      return true;
    } catch (err) {
      setSaveError(headErrorMessage(err, SECTION_COPY.saveFailed));
      setSaveState('error');
      return false;
    } finally {
      saving.current = false;
      if (dirty.current) void save();
    }
  }, [requisitionId, departmentId]);

  const schedule = useCallback(() => {
    if (!hydrated.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }, [save]);

  /** Saves now (Review and send, Back to my list). Resolves false when the save failed. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    // Let a save already in flight finish so the last edit is the last write.
    while (saving.current) await new Promise((r) => setTimeout(r, 40));
    return save();
  }, [save]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  const setQty = useCallback(
    (itemId: string, raw: string) => {
      setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, qty: cleanTyped(raw) } : l)));
      schedule();
    },
    [schedule],
  );

  const commitQty = useCallback(
    (itemId: string) => {
      // A blank or zero quantity is not sendable: restore the last good one (the suggestion, or 1).
      setLines((prev) => prev.map((l) => (l.itemId === itemId && !isValidQty(l.qty) ? { ...l, qty: l.suggestedQty && isValidQty(l.suggestedQty) ? l.suggestedQty : '1' } : l)));
      schedule();
    },
    [schedule],
  );

  const step = useCallback(
    (itemId: string, delta: 1 | -1) => {
      setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, qty: stepQty(l.qty, delta) } : l)));
      schedule();
    },
    [schedule],
  );

  const remove = useCallback(
    (itemId: string) => {
      const gone = latest.current.lines.find((l) => l.itemId === itemId);
      if (!gone) return;
      setLines((prev) => prev.filter((l) => l.itemId !== itemId));
      setRemoved((prev) => [...prev, gone]);
      setUndo(gone);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndo(null), 6000);
      schedule();
    },
    [schedule],
  );

  const undoRemove = useCallback(() => {
    setUndo((gone) => {
      if (!gone) return null;
      setLines((prev) => (prev.some((l) => l.itemId === gone.itemId) ? prev : [...prev, gone]));
      setRemoved((prev) => prev.filter((l) => l.itemId !== gone.itemId));
      return null;
    });
    schedule();
  }, [schedule]);

  const add = useCallback(
    (item: AddableItem) => {
      setLines((prev) => {
        if (prev.some((l) => l.itemId === item.itemId)) return prev;
        return [
          ...prev,
          {
            itemId: item.itemId,
            itemName: item.itemName,
            unit: item.unit,
            categoryPath: item.categoryPath,
            qty: toNumber(item.suggestedQty) > 0 ? item.suggestedQty : '1',
            suggestedQty: null,
            onHand: item.onHand,
            level: item.level,
          },
        ];
      });
      // Adding an item that was removed earlier brings it back as a plain line, not a removal.
      setRemoved((prev) => prev.filter((l) => l.itemId !== item.itemId));
      schedule();
    },
    [schedule],
  );

  const setNote = useCallback(
    (value: string) => {
      setNoteState(value);
      schedule();
    },
    [schedule],
  );

  const counts = useMemo(() => {
    const changed = lines.filter(isChanged).length;
    const added = lines.filter((l) => l.suggestedQty === null).length;
    const removedFromSuggestion = removed.filter((l) => l.suggestedQty !== null).length;
    return { lineCount: lines.length, changed, added, removed: removedFromSuggestion, changes: changed + removedFromSuggestion };
  }, [lines, removed]);

  return {
    edit,
    data,
    ready,
    lines,
    note,
    counts,
    undo,
    saveState,
    saveError,
    anyInvalid: lines.some((l) => !isValidQty(l.qty)),
    setQty,
    commitQty,
    step,
    remove,
    undoRemove,
    add,
    setNote,
    flush,
  };
}
