import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { fulfilDepartment, getFulfilDetail } from '../services';
import type { DepartmentTag, DeliveryNote, FulfilDetail, FulfilLineInput } from '../types';

/** Local per-line edit: dispatch qty, keyed by inventoryItemId (requisition lines) or a synthetic key for a new substitute line. */
export type FulfilLineEdit = { dispatchQty: string; isSubstitute?: boolean; substituteNote?: string };

/**
 * Store-side fulfil hook: loads one requisition's per-department detail,
 * tracks local dispatch-qty edits (pre-filled server-side at
 * min(requested, onHand)), and signs+dispatches one department at a time.
 * Mirrors `use-requisition-approval.ts`'s load/edit/save shape.
 */
export function useDispatchFulfil(requisitionId: string) {
  const [detail, setDetail] = useState<FulfilDetail | null>(null);
  const [edits, setEdits] = useState<Record<string, FulfilLineEdit>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dispatchingSection, setDispatchingSection] = useState<DepartmentTag | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [lastDeliveryNote, setLastDeliveryNote] = useState<DeliveryNote | null>(null);

  const load = useCallback(
    async (isStale: () => boolean) => {
      if (!requisitionId) {
        setDetail(null);
        setStatus('idle');
        return;
      }
      setStatus('loading');
      setError(null);
      try {
        const data = await getFulfilDetail(requisitionId);
        if (isStale()) return;
        setDetail(data);
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

  const setLineEdit = useCallback((inventoryItemId: string, edit: FulfilLineEdit) => {
    setEdits((prev) => ({ ...prev, [inventoryItemId]: edit }));
  }, []);

  // Visible dispatch qty per line, with local edits applied — falls back to
  // the server pre-fill (min(requested, onHand)) when untouched.
  const visibleLinesBySection = useMemo(() => {
    const map: Record<string, FulfilDetail['sections'][number]['lines']> = {};
    if (!detail) return map;
    for (const section of detail.sections) {
      map[section.departmentTag] = section.lines.map((line) => {
        const edit = edits[line.inventoryItemId];
        if (!edit) return line;
        return { ...line, dispatchQty: edit.dispatchQty, isSubstitute: edit.isSubstitute ?? line.isSubstitute, substituteNote: edit.substituteNote ?? line.substituteNote };
      });
    }
    return map;
  }, [detail, edits]);

  const dispatchSection = useCallback(
    async (departmentTag: DepartmentTag, pin: string): Promise<boolean> => {
      if (!detail) return false;
      const section = detail.sections.find((s) => s.departmentTag === departmentTag);
      if (!section) return false;

      const lines: FulfilLineInput[] = (visibleLinesBySection[departmentTag] ?? section.lines).map((line) => ({
        requisitionLineId: line.requisitionLineId,
        inventoryItemId: line.inventoryItemId,
        dispatchQty: line.dispatchQty,
        isSubstitute: line.isSubstitute,
        substituteNote: line.substituteNote ?? undefined,
      }));

      setDispatchingSection(departmentTag);
      setDispatchError(null);
      try {
        const note = await fulfilDepartment(requisitionId, departmentTag, { lines, pin });
        setLastDeliveryNote(note);
        await load(() => false);
        return true;
      } catch (err) {
        setDispatchError(formatApiErrorMessage(err, 'Could not dispatch this department.'));
        return false;
      } finally {
        setDispatchingSection(null);
      }
    },
    [detail, visibleLinesBySection, requisitionId, load],
  );

  return {
    detail,
    visibleLinesBySection,
    setLineEdit,
    dispatchSection,
    dispatchingSection,
    dispatchError,
    lastDeliveryNote,
    status,
    error,
    reload: () => load(() => false),
  };
}
