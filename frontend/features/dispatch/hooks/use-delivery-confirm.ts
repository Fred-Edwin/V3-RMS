import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { confirmDelivery, confirmDeliveryOnBehalf, getDeliveryDetail } from '../services';
import type { ConfirmLineInput, DeliveryNote, DeliveryRow } from '../types';

/**
 * Branch-side confirm hook: loads one dispatch's detail, tracks local
 * confirmed-qty edits (pre-filled server-side at dispatchedQty — the common
 * case is "arrived exactly as sent"), and signs the confirm (or
 * confirm-on-behalf). Mirrors `use-dispatch-fulfil.ts`'s load/edit/sign shape
 * — same "local edits with a server pre-fill, then one sign action" pattern,
 * confirmedQty instead of dispatchQty.
 */
export function useDeliveryConfirm(dispatchId: string) {
  const [detail, setDetail] = useState<DeliveryRow | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [lastDeliveryNote, setLastDeliveryNote] = useState<DeliveryNote | null>(null);

  const load = useCallback(
    async (isStale: () => boolean) => {
      if (!dispatchId) {
        setDetail(null);
        setStatus('idle');
        return;
      }
      setStatus('loading');
      setError(null);
      try {
        const data = await getDeliveryDetail(dispatchId);
        if (isStale()) return;
        setDetail(data);
        setEdits({});
        setStatus('ready');
      } catch (err) {
        if (isStale()) return;
        setError(formatApiErrorMessage(err, 'Could not load this delivery.'));
        setStatus('error');
      }
    },
    [dispatchId],
  );

  useEffect(() => {
    let stale = false;
    void load(() => stale);
    return () => {
      stale = true;
    };
  }, [load]);

  const setLineEdit = useCallback((dispatchLineId: string, confirmedQty: string) => {
    setEdits((prev) => ({ ...prev, [dispatchLineId]: confirmedQty }));
  }, []);

  // Visible confirmed qty per line, with local edits applied — falls back to
  // the dispatched qty pre-fill (the common "arrived exactly as sent" case).
  const visibleLines = useMemo(() => {
    if (!detail) return [];
    return detail.lines.map((line) => ({
      ...line,
      confirmedQty: edits[line.dispatchLineId] ?? line.confirmedQty ?? line.dispatchedQty,
    }));
  }, [detail, edits]);

  const buildLines = useCallback((): ConfirmLineInput[] => {
    return visibleLines.map((line) => ({ dispatchLineId: line.dispatchLineId, confirmedQty: line.confirmedQty }));
  }, [visibleLines]);

  const confirm = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!detail) return false;
      setConfirming(true);
      setConfirmError(null);
      try {
        const note = await confirmDelivery(dispatchId, { lines: buildLines(), pin });
        setLastDeliveryNote(note);
        await load(() => false);
        return true;
      } catch (err) {
        setConfirmError(formatApiErrorMessage(err, 'Could not confirm this delivery.'));
        return false;
      } finally {
        setConfirming(false);
      }
    },
    [detail, dispatchId, buildLines, load],
  );

  const confirmOnBehalf = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!detail) return false;
      setConfirming(true);
      setConfirmError(null);
      try {
        const note = await confirmDeliveryOnBehalf(dispatchId, { lines: buildLines(), pin });
        setLastDeliveryNote(note);
        await load(() => false);
        return true;
      } catch (err) {
        setConfirmError(formatApiErrorMessage(err, 'Could not confirm this delivery.'));
        return false;
      } finally {
        setConfirming(false);
      }
    },
    [detail, dispatchId, buildLines, load],
  );

  return {
    detail,
    visibleLines,
    setLineEdit,
    confirm,
    confirmOnBehalf,
    confirming,
    confirmError,
    lastDeliveryNote,
    status,
    error,
    reload: () => load(() => false),
  };
}
