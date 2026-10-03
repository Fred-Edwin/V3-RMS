import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import {
  approveRequisition,
  getRequisitionForApproval,
  nudgeSectionHead,
  returnRequisitionSection,
  upsertApprovalLines,
} from '../services';
import type {
  ApprovalLineEditInput,
  DepartmentTag,
  RequisitionApprovalDetail,
  RequisitionApprovalLine,
} from '../types';

/** Local pending edit for one line — qty + reason commit together (decision #4). */
export type ApprovalEdit = { approvedQty: string | null; editReason: string | null; deleted?: boolean };

/**
 * Branch Manager review screen's data-loading + local-edit hook. Extends
 * `use-requisition-section.ts`'s dirty-map model: the map value becomes an
 * object (qty + reason) instead of a bare string, because Session B's edit
 * commits both together (decision #4).
 */
export function useRequisitionApproval(requisitionId: string) {
  const [requisition, setRequisition] = useState<RequisitionApprovalDetail | null>(null);
  const [edits, setEdits] = useState<Record<string, ApprovalEdit>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<DepartmentTag | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [returningSection, setReturningSection] = useState<DepartmentTag | null>(null);
  const [nudgingSection, setNudgingSection] = useState<DepartmentTag | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const load = useCallback(
    async (isStale: () => boolean) => {
      // No id selected yet (desktop master-detail's "nothing selected" state,
      // `12UW-0`) — nothing to load, and no error to show.
      if (!requisitionId) {
        setRequisition(null);
        setStatus('idle');
        return;
      }
      setStatus('loading');
      setError(null);
      try {
        const detail = await getRequisitionForApproval(requisitionId);
        if (isStale()) return;
        setRequisition(detail);
        setEdits({});
        setStatus('ready');
      } catch (err) {
        if (isStale()) return;
        setError(formatApiErrorMessage(err, 'Could not load this requisition.'));
        setStatus('error');
      }
    },
    [requisitionId],
  );

  useEffect(() => {
    let stale = false;
    void load(() => stale);
    return () => {
      stale = true;
    };
  }, [load]);

  const setLineEdit = useCallback((lineId: string, edit: ApprovalEdit) => {
    setEdits((prev) => ({ ...prev, [lineId]: edit }));
  }, []);

  const deleteLine = useCallback((lineId: string) => {
    setEdits((prev) => ({ ...prev, [lineId]: { approvedQty: null, editReason: null, deleted: true } }));
  }, []);

  // Server-committed requestedQty per line, keyed by id — drives both the
  // strike-through on Requested and the accent-bordered Approved box.
  const originalRequestedQtyByLineId = useMemo(() => {
    const map: Record<string, string | null> = {};
    if (!requisition) return map;
    for (const section of requisition.sections) {
      for (const line of section.lines) {
        map[line.id] = line.requestedQty;
      }
    }
    return map;
  }, [requisition]);

  // Visible lines per section, with local edits applied for display —
  // deleted lines filtered out (soft-delete is immediate in the UI, the
  // server call happens on next save).
  const visibleLinesBySection = useMemo(() => {
    const map: Record<string, RequisitionApprovalLine[]> = {};
    if (!requisition) return map;
    for (const section of requisition.sections) {
      map[section.departmentTag] = section.lines
        .filter((line) => !edits[line.id]?.deleted)
        .map((line) => {
          const edit = edits[line.id];
          if (!edit) return line;
          return {
            ...line,
            approvedQty: edit.approvedQty,
            editReason: edit.editReason,
            isEdited: edit.approvedQty !== line.requestedQty,
          };
        });
    }
    return map;
  }, [requisition, edits]);

  const saveSection = useCallback(
    async (
      departmentTag: DepartmentTag,
      options?: {
        fillMyself?: boolean;
        newLines?: ApprovalLineEditInput[];
        /**
         * An edit just committed via `setLineEdit` in the same event handler
         * wins over the committed `edits` state — `setState` is async, so a
         * same-tick `setLineEdit(id, x); saveSection(tag);` would otherwise
         * still close over the pre-update `edits` map (stale-closure race,
         * same class of bug `use-requisition-section.ts`'s `save({ managerNote })`
         * guards against).
         */
        pendingEdit?: { lineId: string; edit: ApprovalEdit };
      },
    ): Promise<boolean> => {
      if (!requisition) return false;
      const section = requisition.sections.find((s) => s.departmentTag === departmentTag);
      if (!section) return false;

      const effectiveEdits = options?.pendingEdit
        ? { ...edits, [options.pendingEdit.lineId]: options.pendingEdit.edit }
        : edits;

      const sectionLineIds = new Set(section.lines.map((l) => l.id));
      const editedLines: ApprovalLineEditInput[] = Object.entries(effectiveEdits)
        .filter(([lineId]) => sectionLineIds.has(lineId))
        .map(([id, edit]) => ({ id, approvedQty: edit.approvedQty, editReason: edit.editReason ?? undefined, deleted: edit.deleted }));

      const lines = [...editedLines, ...(options?.newLines ?? [])];
      if (lines.length === 0 && !options?.fillMyself) return true;

      setSavingSection(departmentTag);
      setSaveError(null);
      try {
        const updated = await upsertApprovalLines(requisitionId, departmentTag, { lines, fillMyself: options?.fillMyself });
        setRequisition(updated);
        setEdits((prev) => {
          const next = { ...prev };
          sectionLineIds.forEach((lineId) => delete next[lineId]);
          return next;
        });
        return true;
      } catch (err) {
        setSaveError(formatApiErrorMessage(err, 'Could not save this section.'));
        return false;
      } finally {
        setSavingSection(null);
      }
    },
    [requisition, edits, requisitionId],
  );

  const returnSection = useCallback(
    async (departmentTag: DepartmentTag, note: string): Promise<boolean> => {
      setReturningSection(departmentTag);
      try {
        const updated = await returnRequisitionSection(requisitionId, departmentTag, { note });
        setRequisition(updated);
        return true;
      } catch (err) {
        setError(formatApiErrorMessage(err, 'Could not return this section.'));
        return false;
      } finally {
        setReturningSection(null);
      }
    },
    [requisitionId],
  );

  const nudgeHead = useCallback(
    async (departmentTag: DepartmentTag): Promise<boolean> => {
      setNudgingSection(departmentTag);
      try {
        await nudgeSectionHead(requisitionId, departmentTag);
        return true;
      } catch (err) {
        setError(formatApiErrorMessage(err, 'Could not send the nudge.'));
        return false;
      } finally {
        setNudgingSection(null);
      }
    },
    [requisitionId],
  );

  const approve = useCallback(
    async (pin: string): Promise<boolean> => {
      setApproving(true);
      setApproveError(null);
      try {
        const updated = await approveRequisition(requisitionId, { pin });
        setRequisition(updated);
        return true;
      } catch (err) {
        // The 409 "already approved by another manager" race must flip the
        // screen to the read-only already-approved state, not show a raw
        // error toast — the caller checks `updated.status` after reload.
        setApproveError(formatApiErrorMessage(err, 'Could not approve this requisition.'));
        void load(() => false);
        return false;
      } finally {
        setApproving(false);
      }
    },
    [requisitionId, load],
  );

  return {
    requisition,
    visibleLinesBySection,
    originalRequestedQtyByLineId,
    setLineEdit,
    deleteLine,
    saveSection,
    savingSection,
    saveError,
    returnSection,
    returningSection,
    nudgeHead,
    nudgingSection,
    approve,
    approving,
    approveError,
    status,
    error,
    reload: () => load(() => false),
  };
}
