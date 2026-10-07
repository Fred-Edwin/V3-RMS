import * as React from 'react';

import { cn } from '@/lib/cn';
import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import { formatClock, formatDayAndClock, formatQuantity } from '../../_shared/lib/prep-format';
import type { RunDetail } from '../../_shared/types/prep-contract';
import { reasonLabel } from '../lib/fix-logic';

const row = 'flex items-start justify-between gap-wds-4 border-b border-wds-border px-[14px] py-3 last:border-b-0';
const rowLabel = 'shrink-0 font-wds-sans text-wds-body-sm leading-4 text-wds-text-copy-muted';
const rowValue = 'min-w-0 text-right font-wds-sans text-wds-body font-medium leading-[18px] text-wds-text-ink break-words';

/** Which of the four detail states a run is in for THIS caller (Paper steps 13 and 22, plus the two closed states). */
export type FixMode = 'open' | 'locked' | 'notYours' | 'corrected' | 'cancelled';

export const fixModeOf = (run: RunDetail, forceLocked = false): FixMode => {
  if (run.status === 'CORRECTED') return 'corrected';
  if (run.status === 'CANCELLED') return 'cancelled';
  if (forceLocked || run.can.lockedReason) return 'locked';
  if (!run.can.correct && !run.can.cancel) return 'notYours';
  return 'open';
};

export interface FixRunViewProps {
  run: RunDetail;
  mode: FixMode;
  onCorrect: () => void;
  onCancel: () => void;
  className?: string;
}

/**
 * The run's detail "open to fix" (Paper step 13 `7Y7-0`) and its locked twin (step 22 `8YL-0`): a blue note with the window, the
 * Used / Made / Compared with usual / Recorded by table, and Correct this run / Cancel this run. When the run cannot be fixed the
 * buttons are really disabled (not just grey) and the reason is written above them, plus "Ask the Store Manager".
 */
export function FixRunView({ run, mode, onCorrect, onCancel, className }: FixRunViewProps) {
  const canAct = mode === 'open';
  const fix = PREP_STATES_COPY.fix;
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4', className)}>
      {mode === 'open' ? (
        run.windowEndsAt ? (
          <div role="note" className="border border-wds-info-border bg-wds-info-bg px-3 py-[10px] font-wds-sans text-wds-body-sm leading-[18px] text-wds-info-fg">
            You can correct or cancel this run until {formatDayAndClock(run.windowEndsAt)}. After that, ask the Store Manager.
          </div>
        ) : (
          <div role="note" className="border border-wds-border bg-wds-neutral-50 px-3 py-[10px] font-wds-sans text-wds-body-sm leading-[18px] text-wds-text-copy-muted">
            As Store Manager you can correct or cancel any run, whatever its age.
          </div>
        )
      ) : null}
      {mode === 'locked' ? (
        <div role="note" className="flex flex-col gap-0.5 border border-wds-warning-border bg-wds-warning-bg px-3 py-[10px] font-wds-sans text-wds-body-sm leading-[18px] text-wds-warning-fg">
          <span>{fix.lockedTitle}</span>
          <span>{fix.lockedBody}</span>
        </div>
      ) : null}
      {mode === 'notYours' ? (
        <div role="note" className="border border-wds-border bg-wds-neutral-50 px-3 py-[10px] font-wds-sans text-wds-body-sm leading-[18px] text-wds-text-copy-muted">
          {fix.notYoursBody}
        </div>
      ) : null}
      {mode === 'corrected' ? (
        <div role="note" className="flex flex-col gap-0.5 border border-wds-info-border bg-wds-info-bg px-3 py-[10px] font-wds-sans text-wds-body-sm leading-[18px] text-wds-info-fg">
          <span className="font-medium">{fix.correctedTitle}</span>
          <span>{run.replacedBy ? `It was replaced by ${run.replacedBy.reference}. This run stays on record.` : 'It stays on record.'}</span>
        </div>
      ) : null}
      {mode === 'cancelled' ? (
        <div role="note" className="flex flex-col gap-0.5 border border-wds-error-border bg-wds-error-bg px-3 py-[10px] font-wds-sans text-wds-body-sm leading-[18px] text-wds-error-fg">
          <span className="font-medium">{fix.cancelledTitle}</span>
          <span>
            {run.cancellation ? `${reasonLabel(run.cancellation.reason)} · ${run.cancellation.by.name}, ${formatDayAndClock(run.cancellation.at)}. ` : ''}It stays on record.
          </span>
        </div>
      ) : null}

      <dl className="border border-wds-border bg-wds-surface">
        <div className={row}>
          <dt className={rowLabel}>Used</dt>
          <dd className={cn(rowValue, 'flex flex-col items-end gap-[3px]')}>
            {run.inputs.map((line) => (
              <span key={line.itemId}>
                {line.itemName} {formatQuantity(line.quantity)} {line.unit}
              </span>
            ))}
          </dd>
        </div>
        <div className={row}>
          <dt className={rowLabel}>Made</dt>
          <dd className={rowValue}>
            {run.outputName} {formatQuantity(run.made)} {run.unit}
          </dd>
        </div>
        <div className={row}>
          <dt className={rowLabel}>Compared with usual</dt>
          <dd className={cn(rowValue, run.vsUsual.label === 'ON_TARGET' ? 'text-wds-success-fg' : run.vsUsual.label === 'NO_BASIS' ? 'text-wds-text-copy-muted' : 'text-wds-warning-fg')}>
            <span aria-hidden>● </span>
            {run.vsUsual.text.charAt(0).toUpperCase() + run.vsUsual.text.slice(1)}
          </dd>
        </div>
        <div className={row}>
          <dt className={rowLabel}>Recorded by</dt>
          <dd className={rowValue}>
            {run.by.name} · {formatClock(run.at)}
          </dd>
        </div>
      </dl>

      <div className="flex-1" />

      {mode === 'corrected' || mode === 'cancelled' || mode === 'notYours' ? null : (
        <div className="flex flex-col gap-[10px]">
          <button
            type="button"
            disabled={!canAct}
            onClick={onCorrect}
            className={cn(
              'flex h-[52px] w-full items-center justify-center border font-wds-sans text-[16px] font-semibold leading-5 outline-none transition-colors focus-visible:shadow-wds-ring',
              canAct ? 'border-wds-espresso-700 bg-wds-espresso-50 text-wds-espresso-700 hover:bg-wds-espresso-100' : 'cursor-not-allowed border-wds-neutral-100 bg-wds-neutral-100 text-wds-text-copy-faint'
            )}
          >
            Correct this run
          </button>
          <button
            type="button"
            disabled={!canAct}
            onClick={onCancel}
            className={cn(
              'flex h-12 w-full items-center justify-center border font-wds-sans text-wds-section font-medium leading-[18px] outline-none transition-colors focus-visible:shadow-wds-ring',
              canAct ? 'border-wds-error-border bg-wds-surface text-wds-error-fg hover:bg-wds-error-bg' : 'cursor-not-allowed border-wds-neutral-100 bg-wds-neutral-100 text-wds-text-copy-faint'
            )}
          >
            Cancel this run
          </button>
          {mode === 'locked' ? <p className="text-center font-wds-sans text-wds-body-sm font-medium text-wds-espresso-700">{PREP_STATES_COPY.locked.title}</p> : null}
        </div>
      )}
    </div>
  );
}
