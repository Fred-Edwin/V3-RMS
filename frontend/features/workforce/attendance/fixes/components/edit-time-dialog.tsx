'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { Callout, ChoiceChips, DialogButton, EMPTY_REASON, KitDialog, ReasonChips, TimeField, reasonText, useAction, type ReasonValue } from '../../../_shared';
import { longDayWords } from '../../_shared/lib/nairobi-clock';
import { attendanceWrites } from '../../_shared/services/attendance-services';
import type { DayHistory, FixView } from '../../_shared/types/attendance-types';
import { FIX_REASONS, bodyOf, changeProblem, eventRows, inOutWords, totalWords, workedChangeWords, type Change } from '../lib/fix-model';
import { HistoryList } from './history-list';

const LABELS = Object.fromEntries(FIX_REASONS.map((r) => [r.key, r.label]));

/**
 * "Edit time" (Paper Chapter 7 step 6): the clock events of one shift with what was recorded and what will be, a reason that is always
 * required, and the day before and after (from the server's preview, which writes nothing). One change at a time: edit a time, add a
 * missing event, or remove one. The old value stays in the history. Nobody fixes their own time; the server's refusal shows in words.
 */
export function EditTimeDialog({
  history,
  entryId,
  onClose,
  onDone,
}: {
  history: DayHistory;
  entryId: string | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [change, setChange] = React.useState<Change | null>(null);
  const [reason, setReason] = React.useState<ReasonValue>(EMPTY_REASON);
  const [preview, setPreview] = React.useState<FixView | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const action = useAction((message) => onDone(message ?? 'Saved.'));
  const entry = history.entries.find((e) => e.entryId === entryId) ?? null;
  const rows = eventRows(history, entryId);
  const text = reasonText(reason, LABELS);
  const problem = changeProblem(change, history.date, text, Date.now());
  const rotaEntryId = entryId ?? undefined;

  // The preview asks the server what the day would become; the reason is not part of the picture, so a stand-in is sent.
  React.useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    if (!change || changeProblem(change, history.date, 'preview', Date.now())) return;
    const body = bodyOf(change, history.employeeId, history.date, 'preview', rotaEntryId);
    if (!body) return;
    let cancelled = false;
    const id = setTimeout(() => {
      attendanceWrites.previewFix(body).then(
        (view) => !cancelled && setPreview(view),
        (err: unknown) => !cancelled && setPreviewError(err instanceof Error ? err.message : 'That change cannot be made.')
      );
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [change, history.date, history.employeeId, rotaEntryId]);

  const save = (): void => {
    if (!change || !text) return;
    const body = bodyOf(change, history.employeeId, history.date, text, rotaEntryId);
    if (body) void action.run(() => attendanceWrites.applyFix(body), `Saved. ${history.name} is told what changed.`);
  };

  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      busy={action.busy}
      width={640}
      title={`Edit time · ${history.name}`}
      description={`${longDayWords(history.date)}${entry ? ` · ${entry.templateName} ${entry.startTime} to ${entry.endTime}` : ''}`}
      footer={
        <>
          <button type="button" onClick={() => setShowHistory((s) => !s)} className="mr-auto font-wds-sans text-[13px] leading-4 text-wds-primary underline-offset-2 hover:underline">
            {showHistory ? 'Hide history' : 'See history'}
          </button>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>
            Cancel
          </DialogButton>
          <DialogButton kind="primary" size="lg" disabled={action.busy || problem !== null} title={problem ?? undefined} onClick={save}>
            {action.busy ? 'Saving…' : 'Save change'}
          </DialogButton>
        </>
      }
    >
      <div className="flex flex-col border border-wds-border" role="table" aria-label="Clock events">
        <div role="row" className="flex h-8 items-center border-b border-wds-text-ink px-3.5 font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">
          <span role="columnheader" className="w-[110px] shrink-0">EVENT</span>
          <span role="columnheader" className="w-[130px] shrink-0">RECORDED</span>
          <span role="columnheader" className="w-[130px] shrink-0">NEW</span>
          <span role="columnheader" className="grow basis-0">SOURCE</span>
        </div>
        {rows.length === 0 ? <p className="m-0 px-3.5 py-3 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">No clock events on this shift yet.</p> : null}
        {rows.map((row) => {
          const editing = change?.action === 'EDIT' && change.eventId === row.id;
          const removing = change?.action === 'VOID' && change.eventId === row.id;
          return (
            <div key={row.id} role="row" className={cn('flex min-h-11 items-center border-b border-wds-neutral-100 px-3.5 py-1.5 last:border-b-0', (editing || removing) && 'bg-wds-caramel-100/55')}>
              <span role="cell" className="w-[110px] shrink-0 font-wds-sans text-[13px] leading-4 text-wds-text-ink">{row.label}</span>
              <span role="cell" className={cn('w-[130px] shrink-0 font-wds-mono text-[14px] leading-5', (editing || removing) && 'text-wds-error-fg line-through')}>
                {row.recorded}{row.auto ? ' (auto-closed)' : ''}
              </span>
              <span role="cell" className="flex w-[130px] shrink-0 items-center">
                {editing ? (
                  <TimeField label="New time" value={change.hm} onChange={(hm) => setChange({ action: 'EDIT', eventId: row.id, hm })} className="w-[110px]" />
                ) : removing ? (
                  <span className="font-wds-sans text-[13px] leading-4 text-wds-error-fg">removed</span>
                ) : (
                  <span className="font-wds-mono text-[14px] leading-5 text-wds-text-faint">no change</span>
                )}
              </span>
              <span role="cell" className="flex grow basis-0 items-center justify-between gap-2 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                {row.source}
                <span className="flex gap-3">
                  <button type="button" onClick={() => setChange({ action: 'EDIT', eventId: row.id, hm: row.recorded })} className="min-h-8 text-wds-warning-fg underline underline-offset-2">Edit</button>
                  <button type="button" onClick={() => setChange({ action: 'VOID', eventId: row.id })} className="min-h-8 text-wds-warning-fg underline underline-offset-2">Remove</button>
                </span>
              </span>
            </div>
          );
        })}
        {change?.action === 'ADD' ? (
          <div role="row" className="flex min-h-11 items-center gap-3 border-t border-wds-neutral-100 bg-wds-caramel-100/55 px-3.5 py-1.5">
            <ChoiceChips legend="Which event is missing?" legendStyle="sentence" size="sm" value={change.type} onChange={(v) => setChange({ ...change, type: v === 'OUT' ? 'OUT' : 'IN' })} options={[{ value: 'IN', label: 'Clock in' }, { value: 'OUT', label: 'Clock out' }]} />
            <TimeField label="Time of the missing event" value={change.hm} onChange={(hm) => setChange({ ...change, hm })} className="w-[140px]" />
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setChange({ action: 'ADD', type: 'OUT', hm: '' })} className="font-wds-sans text-[13px] leading-4 text-wds-primary hover:underline">+ Add a missing clock event</button>
        {preview ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{workedChangeWords(preview.before, preview.after)}</span> : null}
      </div>
      {preview ? (
        <div className="grid grid-cols-2 border border-wds-border" aria-label="The day before and after">
          <div className="flex flex-col gap-0.5 px-4 py-3">
            <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">RECORDED</span>
            <span className="font-wds-mono text-[16px] leading-6 text-wds-error-fg">{inOutWords(preview.before)}</span>
            <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{totalWords(preview.before)}</span>
          </div>
          <div className="flex flex-col gap-0.5 border-l border-wds-border bg-wds-success-bg px-4 py-3">
            <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-success-fg">AFTER THIS CHANGE</span>
            <span className="font-wds-mono text-[16px] leading-6 text-wds-success-fg">{inOutWords(preview.after)}</span>
            <span className="font-wds-sans text-[12px] leading-4 text-wds-success-fg">{totalWords(preview.after)}</span>
          </div>
        </div>
      ) : null}
      {previewError ? <Callout tone="error" size="sm">{previewError}</Callout> : null}
      <ReasonChips legend="Reason, required" legendStyle="sentence" options={[...FIX_REASONS]} value={reason} onChange={setReason} disabled={action.busy} />
      <Callout size="sm" bullet>
        The old value stays visible in the history. {history.name.split(' ')[0]} is told. After a pay period closes only HR can change this, with a reason.
      </Callout>
      {showHistory ? <HistoryList history={history} entryId={entryId} /> : null}
      {action.error ? <Callout tone="error" role="alert" size="sm">{action.error}</Callout> : null}
    </KitDialog>
  );
}
