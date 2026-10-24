'use client';

import * as React from 'react';

import { Callout, DIALOG_LEADS, DialogButton, EMPTY_REASON, ErrorBlock, KitDialog, ListSkeleton, ReasonChips, StatBoxes, reasonText, useRemote, type ReasonValue } from '../../_shared';
import { COPY_NOTE, COPY_REASON_NOTE, NEAR_TERM_REASONS } from '../_shared/lib/rota-copy';
import { reasonProblem } from '../_shared/lib/rota-edits';
import { shortDay, weekShortRange } from '../_shared/lib/rota-dates';
import { rotaWrites } from '../_shared/services/rota-services';
import type { Clash, CopyBody } from '../_shared/types/rota-types';

const LABELS = Object.fromEntries(NEAR_TERM_REASONS.map((r) => [r.key, r.label]));
const clashWords = (c: Clash): string => `${c.name} · ${shortDay(c.date)}`;

/**
 * "Start from last week" (Paper step 3): the server previews what the copy would do (nothing is written), then the copy fills empty
 * cells only. A clash (leave, sent to another site, no longer employed, a shift that is gone) is listed and never copied.
 */
export function CopyWeekDialog({
  siteId,
  weekStart,
  departmentId,
  departmentName,
  run,
  onClose,
}: {
  siteId: string | undefined;
  weekStart: string;
  departmentId: string | undefined;
  departmentName: string | null;
  /** Saves through the editor so the status line follows; resolves to the server's words if refused. */
  run: (write: () => Promise<unknown>) => Promise<string | null>;
  onClose: () => void;
}) {
  const base: CopyBody = { siteId, weekStart, departmentId };
  const preview = useRemote(() => rotaWrites.copyPreview(base), `copy:${siteId ?? ''}:${weekStart}:${departmentId ?? ''}`);
  const [reason, setReason] = React.useState<ReasonValue>(EMPTY_REASON);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const data = preview.data;
  const text = reasonText(reason, LABELS);
  const needReason = data?.reasonRequired ?? false;
  const blocked = !data || data.shiftsCopied === 0 || (needReason && reasonProblem(text) !== null);
  const why = !data ? undefined : data.shiftsCopied === 0 ? 'There is nothing to copy into empty cells.' : needReason && reasonProblem(text) ? 'Say why first.' : undefined;

  const copy = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const refusal = await run(() => rotaWrites.copy({ ...base, ...(needReason && text ? { reason: text } : {}) }));
    setBusy(false);
    if (refusal) setError(refusal);
    else onClose();
  };

  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      busy={busy}
      width={640}
      title="Start from last week?"
      description={
        data
          ? DIALOG_LEADS.copyWeek(weekShortRange(data.copiedFrom), weekShortRange(data.weekStart), departmentName)
          : 'Checking what last week would copy.'
      }
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={busy}>
            Cancel
          </DialogButton>
          <DialogButton kind="primary" size="lg" disabled={blocked || busy} title={why} onClick={() => void copy()}>
            {busy ? 'Copying…' : 'Copy last week'}
          </DialogButton>
        </>
      }
    >
      {preview.status === 'loading' ? <ListSkeleton rows={3} label="Checking last week" /> : null}
      {preview.status === 'error' ? <ErrorBlock title="Could not check last week" line={preview.error.message} reference={preview.error.code} onRetry={preview.reload} /> : null}
      {data ? (
        <>
          <StatBoxes
            variant="compact"
            cells={[
              { label: 'Shifts copied', value: data.shiftsCopied },
              { label: 'People', value: data.people },
              { label: 'Left out, you decide', value: data.clashes.length, tone: data.clashes.length > 0 ? 'warning' : 'default' },
            ]}
          />
          {data.clashes.length > 0 ? (
            <section aria-label="Left out because they would clash" className="flex flex-col gap-2.5">
              <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">LEFT OUT BECAUSE THEY WOULD CLASH</h3>
              <ul className="m-0 max-h-[180px] list-none overflow-y-auto border border-wds-border p-0">
                {data.clashes.map((c) => (
                  <li key={`${c.employeeId}${c.date}`} className="flex items-center justify-between gap-4 border-b border-wds-neutral-100 px-3.5 py-2.5 last:border-b-0">
                    <span className="flex items-center gap-2.5 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
                      <span aria-hidden className="h-1.5 w-1.5 shrink-0 bg-wds-caramel-600" />
                      {clashWords(c)}
                    </span>
                    <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{c.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {needReason ? (
            <>
              <ReasonChips legend="Reason" legendStyle="sentence" hint="required" options={[...NEAR_TERM_REASONS]} value={reason} onChange={setReason} disabled={busy} />
              <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{COPY_REASON_NOTE}</p>
            </>
          ) : null}
          <Callout tone="neutral" bullet size="sm">
            {COPY_NOTE}
            {' "Left out" shifts would clash with leave, a move to another site, or a person who has left. Set those by hand.'}
            {data.kept > 0 ? ` ${data.kept} ${data.kept === 1 ? 'day already has' : 'days already have'} a shift and ${data.kept === 1 ? 'is' : 'are'} kept as it is.` : ''}
          </Callout>
        </>
      ) : null}
      {error ? (
        <Callout tone="error" role="alert" size="sm">
          {error}
        </Callout>
      ) : null}
    </KitDialog>
  );
}
