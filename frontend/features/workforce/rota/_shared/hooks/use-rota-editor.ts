'use client';

import { useCallback, useRef, useState } from 'react';

import { ApiError, formatApiErrorMessage } from '@/types/api';

import { effectiveChanges, gateOf, type EditGate } from '../lib/rota-edits';
import { rotaWrites } from '../services/rota-services';
import type { CellChange, WeekView, WriteReasons } from '../types/rota-types';

/**
 * Every edit to the week goes through here. There is no publish step: an edit is sent the moment it is made, saved, live to staff and
 * audited as one write (the server tells staff once, a few minutes after the last change). The screen stops to ask only when the server
 * would: a shift on an approved-leave day needs an override reason, and a change to today or tomorrow needs a reason.
 */

export type SaveStatus = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: number } | { kind: 'error'; message: string };

export interface EditRequest {
  /** What the cells end up as: used to decide what to ask and to write the summary. */
  changes: CellChange[];
  send: (reasons: WriteReasons) => Promise<unknown>;
}

export interface PendingEdit {
  edit: EditRequest;
  gate: EditGate;
  stage: 'leave' | 'reason';
  overrideReason?: string;
  /** The server's words when it refused this attempt. */
  error: string | null;
  busy: boolean;
}

export function useRotaEditor(week: WeekView | null, siteId: string | undefined, reload: () => void) {
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [pending, setPending] = useState<PendingEdit | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  /** Sends one edit after the ones before it, so a fast run of keystrokes lands in order. Resolves to the server's refusal, if any. */
  const send = useCallback(
    (edit: EditRequest, reasons: WriteReasons): Promise<ApiError | Error | null> => {
      setStatus({ kind: 'saving' });
      const result = queue.current.then(async (): Promise<ApiError | Error | null> => {
        try {
          await edit.send(reasons);
          setStatus({ kind: 'saved', at: Date.now() });
          return null;
        } catch (err) {
          setStatus({ kind: 'error', message: formatApiErrorMessage(err, 'That did not save. Nothing was changed.') });
          return err instanceof Error ? err : new Error('Save failed');
        } finally {
          reload();
        }
      });
      queue.current = result.then(() => undefined);
      return result;
    },
    [reload]
  );

  /** The one entry point: a gate that needs no answer sends at once. */
  const submit = useCallback(
    (edit: EditRequest): void => {
      if (!week) return;
      const changes = effectiveChanges(week, edit.changes);
      if (changes.length === 0) return;
      const gate = gateOf(week, changes);
      const next: EditRequest = { ...edit, changes };
      if (gate.leaveCells.length === 0 && gate.reasonDates.length === 0) {
        void send(next, {}).then((refusal) => {
          // The server may know better than the screen's clock: ask now rather than lose the edit.
          if (refusal instanceof ApiError && (refusal.code === 'REASON_REQUIRED' || refusal.code === 'LEAVE_OVERRIDE_REQUIRED')) {
            setStatus({ kind: 'idle' });
            setPending({ edit: next, gate: { reasonDates: Array.from(new Set(changes.map((c) => c.date))), leaveCells: gate.leaveCells }, stage: refusal.code === 'REASON_REQUIRED' ? 'reason' : 'leave', error: null, busy: false });
          }
        });
        return;
      }
      setPending({ edit: next, gate, stage: gate.leaveCells.length > 0 ? 'leave' : 'reason', error: null, busy: false });
    },
    [week, send]
  );

  const answer = useCallback(
    async (text: string): Promise<void> => {
      if (!pending) return;
      const reasons: WriteReasons = pending.stage === 'leave' ? { overrideReason: text } : { ...(pending.overrideReason ? { overrideReason: pending.overrideReason } : {}), reason: text };
      // The leave answer comes first; the reason (if one is also needed) is asked next, then everything is sent once.
      if (pending.stage === 'leave' && pending.gate.reasonDates.length > 0) {
        setPending({ ...pending, stage: 'reason', overrideReason: text, error: null });
        return;
      }
      setPending({ ...pending, busy: true, error: null });
      const refusal = await send(pending.edit, reasons);
      if (refusal) setPending((p) => (p ? { ...p, busy: false, error: formatApiErrorMessage(refusal, 'That did not save. Nothing was changed.') } : p));
      else setPending(null);
    },
    [pending, send]
  );

  /** A write the screen has already asked about (the copy dialog): saved with the same status line. Resolves to the server's words if refused. */
  const runWrite = useCallback(
    async (write: () => Promise<unknown>): Promise<string | null> => {
      const refusal = await send({ changes: [], send: write }, {});
      return refusal ? formatApiErrorMessage(refusal, 'That did not save. Nothing was changed.') : null;
    },
    [send]
  );

  const cancel = useCallback(() => setPending(null), []);
  const setCell = useCallback((employeeId: string, date: string, templateId: string | null) => {
    submit({ changes: [{ employeeId, date, templateIds: templateId ? [templateId] : [] }], send: (r) => rotaWrites.setCells({ siteId, changes: [{ employeeId, date, templateIds: templateId ? [templateId] : [] }], ...r }) });
  }, [submit, siteId]);
  const fillRow = useCallback((employeeId: string, dates: string[], templateId: string | null) => {
    const changes = dates.map((date) => ({ employeeId, date, templateIds: templateId ? [templateId] : [] }));
    submit({ changes, send: (r) => rotaWrites.fill({ siteId, employeeIds: [employeeId], dates, templateId, ...r }) });
  }, [submit, siteId]);
  const setMany = useCallback((changes: CellChange[]) => {
    submit({ changes, send: (r) => rotaWrites.setCells({ siteId, changes, ...r }) });
  }, [submit, siteId]);

  return { status, pending, answer, cancel, setCell, fillRow, setMany, runWrite };
}
