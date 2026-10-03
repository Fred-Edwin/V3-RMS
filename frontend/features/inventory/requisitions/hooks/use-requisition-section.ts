import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import {
  getRequisitionSection,
  recallRequisitionSection,
  submitRequisitionSection,
  upsertRequisitionLines,
} from '../services';
import type { DepartmentTag, RequisitionSectionDetail, RequisitionSectionLine } from '../types';

export interface NewLineDraft {
  /** Client-local id for a not-yet-saved added line (never sent to the server). */
  draftId: string;
  inventoryItemId: string;
  itemName: string;
  usageUnit: string;
  categoryName: string | null;
  parentCategoryName: string | null;
}

/**
 * Screen 2a's data-loading + local-edit hook: loads the section, holds a
 * local edits map (lineId -> pending requestedQty, matching
 * `use-restock-levels.ts`'s dirty-map shape) so unedited values render plain
 * and edited ones get the accent treatment, and exposes save/submit/recall.
 *
 * Pre-submit line deletion (trash icon) and new-item adds are held purely
 * client-side until `save()` — a line never existed server-side if never
 * saved (session-a-plan.md §5 step 9's recommended resolution). That
 * resolution only covers a line added and removed again within the SAME
 * unsaved session — an already-persisted line (loaded from the server, or
 * saved by an earlier `save()` this session) has no server-side delete this
 * milestone (Session B's capability), so removing it from the next PATCH
 * payload would silently no-op, not delete it. `canDeleteLine` gates the
 * trash icon so only a genuinely not-yet-saved draft line is removable;
 * an already-saved line can only be zeroed via the stepper (zero-not-delete).
 */
export function useRequisitionSection(requisitionId: string, departmentTag: DepartmentTag) {
  const [section, setSection] = useState<RequisitionSectionDetail | null>(null);
  const [edits, setEdits] = useState<Record<string, string | null>>({});
  const [newLines, setNewLines] = useState<NewLineDraft[]>([]);
  const [newLineQtys, setNewLineQtys] = useState<Record<string, string | null>>({});
  const [managerNoteDraft, setManagerNoteDraft] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [recalling, setRecalling] = useState(false);

  const resetLocalEdits = useCallback(() => {
    setEdits({});
    setNewLines([]);
    setNewLineQtys({});
    setManagerNoteDraft(undefined);
  }, []);

  const load = useCallback(
    async (isStale: () => boolean) => {
      setStatus('loading');
      setError(null);
      try {
        const detail = await getRequisitionSection(requisitionId, departmentTag);
        if (isStale()) return;
        setSection(detail);
        resetLocalEdits();
        setStatus('ready');
      } catch (err) {
        if (isStale()) return;
        setError(formatApiErrorMessage(err, 'Could not load your section.'));
        setStatus('error');
      }
    },
    [requisitionId, departmentTag, resetLocalEdits],
  );

  useEffect(() => {
    let stale = false;
    void load(() => stale);
    return () => {
      stale = true;
    };
  }, [load]);

  const setQty = useCallback((lineId: string, value: string | null) => {
    setEdits((prev) => ({ ...prev, [lineId]: value }));
  }, []);

  /** Only a not-yet-saved draft line (id prefixed `draft-`) can actually be removed — see the hook's own header comment. */
  const canDeleteLine = useCallback((lineId: string) => lineId.startsWith('draft-'), []);

  const addItem = useCallback((item: { inventoryItemId: string; itemName: string; usageUnit: string; categoryName: string | null; parentCategoryName: string | null }) => {
    const draftId = `draft-${item.inventoryItemId}-${Date.now()}`;
    setNewLines((prev) => [...prev, { draftId, ...item }]);
  }, []);

  const setNewLineQty = useCallback((draftId: string, value: string | null) => {
    setNewLineQtys((prev) => ({ ...prev, [draftId]: value }));
  }, []);

  const removeNewLine = useCallback((draftId: string) => {
    setNewLines((prev) => prev.filter((l) => l.draftId !== draftId));
    setNewLineQtys((prev) => {
      const next = { ...prev };
      delete next[draftId];
      return next;
    });
  }, []);

  const deleteLine = useCallback(
    (lineId: string) => {
      if (lineId.startsWith('draft-')) {
        removeNewLine(lineId);
      }
      // Not reachable through the UI (the trash icon is disabled for a
      // persisted line — see canDeleteLine), kept as a defensive no-op
      // rather than silently recording an untranslatable delete.
    },
    [removeNewLine],
  );

  const setManagerNote = useCallback((note: string) => {
    setManagerNoteDraft(note);
  }, []);

  // Visible lines: live section lines with edits applied for display, plus
  // not-yet-saved new lines rendered inline. No delete-filter here —
  // deletion only ever removes a draft line outright from `newLines`.
  const visibleLines = useMemo((): RequisitionSectionLine[] => {
    if (!section) return [];
    const existing = section.lines.map((line) => (line.id in edits ? { ...line, requestedQty: edits[line.id] } : line));
    const drafted: RequisitionSectionLine[] = newLines.map((l) => ({
      id: l.draftId,
      inventoryItemId: l.inventoryItemId,
      itemName: l.itemName,
      usageUnit: l.usageUnit,
      categoryName: l.categoryName,
      parentCategoryName: l.parentCategoryName,
      parAtRequest: null,
      requestedQty: newLineQtys[l.draftId] ?? null,
    }));
    return [...existing, ...drafted];
  }, [section, edits, newLines, newLineQtys]);

  const isDirty =
    Object.keys(edits).length > 0 || newLines.length > 0 || managerNoteDraft !== undefined;

  const changedCount = Object.keys(edits).length + newLines.length;

  // Server-committed quantity per persisted line, keyed by id — the "changed
  // from N" caption and accent-border treatment compare a line's live
  // (edited) value against this, not against the edit itself.
  const originalQtyByLineId = useMemo(() => {
    if (!section) return {};
    const map: Record<string, string | null> = {};
    for (const line of section.lines) {
      map[line.id] = line.requestedQty;
    }
    return map;
  }, [section]);

  const save = useCallback(
    async (options?: { managerNote?: string }): Promise<boolean> => {
      // An explicit `options.managerNote` (passed by a caller that just
      // called setManagerNote in the same event handler) wins over the
      // committed `managerNoteDraft` state — setState is async, so a
      // same-tick `setManagerNote(x); save();` would otherwise still close
      // over the pre-update value (stale-closure race).
      const managerNote = options && 'managerNote' in options ? options.managerNote : managerNoteDraft;
      if (!isDirty && managerNote === undefined) return true;
      setSaving(true);
      setSaveError(null);
      try {
        const lines = [
          ...Object.entries(edits).map(([id, requestedQty]) => ({ id, requestedQty })),
          ...newLines.map((l) => ({
            inventoryItemId: l.inventoryItemId,
            requestedQty: newLineQtys[l.draftId] ?? null,
          })),
        ];
        const updated = await upsertRequisitionLines(requisitionId, departmentTag, {
          lines,
          managerNote,
        });
        setSection(updated);
        resetLocalEdits();
        return true;
      } catch (err) {
        setSaveError(formatApiErrorMessage(err, 'Could not save your section.'));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [isDirty, edits, newLines, newLineQtys, managerNoteDraft, requisitionId, departmentTag, resetLocalEdits],
  );

  const submit = useCallback(async (): Promise<boolean> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (isDirty) {
        const saved = await save();
        if (!saved) return false;
      }
      const updated = await submitRequisitionSection(requisitionId, departmentTag);
      setSection(updated);
      return true;
    } catch (err) {
      setSubmitError(formatApiErrorMessage(err, 'Could not submit your section.'));
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [isDirty, save, requisitionId, departmentTag]);

  const recall = useCallback(async (): Promise<boolean> => {
    setRecalling(true);
    try {
      const updated = await recallRequisitionSection(requisitionId, departmentTag);
      setSection(updated);
      return true;
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not recall your section.'));
      return false;
    } finally {
      setRecalling(false);
    }
  }, [requisitionId, departmentTag]);

  return {
    section,
    lines: visibleLines,
    setQty,
    deleteLine,
    canDeleteLine,
    addItem,
    setNewLineQty,
    removeNewLine,
    managerNote: managerNoteDraft ?? section?.managerNote ?? null,
    setManagerNote,
    isDirty,
    changedCount,
    originalQtyByLineId,
    save,
    saving,
    saveError,
    submit,
    submitting,
    submitError,
    recall,
    recalling,
    status,
    error,
    reload: () => load(() => false),
  };
}
