import * as React from 'react';

import { cn } from '@/lib/cn';
import { StatusDot } from '@/components/ui2/status-dot';
import { formatKes, formatWhen, withUnit } from '../../_shared/lib/prep-format';
import type { RunDetail } from '../../_shared/types/prep-contract';
import { drawerStatus, saidWho, stockWarningSentence, yieldGapSentence, yieldReasonWords } from '../lib/run-copy';

const label = 'font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-copy-muted';
const head = 'font-wds-mono text-[10px] font-normal uppercase leading-3 tracking-[0.06em] text-wds-text-ink';

const REASON_WORDS: Record<string, string> = {
  TYPO: 'Typo',
  WRONG_ITEM: 'Wrong item',
  WRONG_QUANTITY: 'Wrong quantity',
  ENTERED_TWICE: 'Entered twice',
  NEVER_MADE: 'Never made',
  OTHER: 'Other',
};
/** Slice 3 may send the reason as a code or as words; either reads well. */
const reasonWords = (reason: string): string => REASON_WORDS[reason] ?? reason;

function Note({ tone, children }: { tone: 'warning' | 'info' | 'error'; children: React.ReactNode }) {
  const classes = {
    warning: 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg',
    info: 'border-wds-info-border bg-wds-info-bg text-wds-info-fg',
    error: 'border-wds-error-border bg-wds-error-bg text-wds-error-fg',
  }[tone];
  return <div className={cn('border px-3 py-2.5 font-wds-sans text-wds-body-sm leading-[18px]', classes)}>{children}</div>;
}

function InputsTable({ run }: { run: RunDetail }) {
  const showStock = run.inputs.some((line) => line.onHand !== undefined);
  const showCost = run.inputs.some((line) => line.lineCost !== undefined);
  return (
    <table className="w-full table-fixed border-collapse font-wds-sans text-wds-body-sm">
      <caption className="sr-only">Inputs used in this run</caption>
      <colgroup>
        <col />
        <col className="w-[64px]" />
        {showStock ? <col className="w-[130px]" /> : null}
        {showCost ? <col className="w-[84px]" /> : null}
      </colgroup>
      <thead>
        <tr className="h-8 border-b border-wds-text-ink">
          <th scope="col" className={cn(head, 'text-left')}>
            Input used
          </th>
          <th scope="col" className={cn(head, 'text-right')}>
            Used
          </th>
          {showStock ? (
            <th scope="col" className={cn(head, 'text-right')}>
              Expected in stock
            </th>
          ) : null}
          {showCost ? (
            <th scope="col" className={cn(head, 'text-right')}>
              Cost
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {run.inputs.map((line) => (
          <tr key={`${line.itemId}-${line.itemName}`} className="h-11 border-b border-wds-border">
            <td className="truncate pr-2 text-wds-text-ink" title={line.itemName}>
              {line.itemName}
            </td>
            <td className="whitespace-nowrap text-right text-wds-text-ink">{withUnit(line.quantity, line.unit)}</td>
            {showStock ? (
              <td className={cn('whitespace-nowrap text-right', line.exceedsStock ? 'text-wds-warning-fg' : 'text-wds-text-copy-muted')}>
                {line.onHand === undefined ? (
                  ''
                ) : line.exceedsStock ? (
                  <StatusDot tone="warning" className="text-[13px]">
                    <span className="sr-only">More than the system expected in stock: </span>
                    {withUnit(line.onHand, line.unit)}
                  </StatusDot>
                ) : (
                  withUnit(line.onHand, line.unit)
                )}
              </td>
            ) : null}
            {showCost ? <td className="whitespace-nowrap text-right text-wds-text-copy-muted">{line.lineCost === undefined ? '' : formatKes(line.lineCost)}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface RunDrawerBodyProps {
  run: RunDetail;
  /** Opens a linked run (the one this replaces, or the one that replaced it). */
  onOpenRun?: (id: string) => void;
}

/**
 * Everything the drawer shows about one run (Paper step 11 `7PT-0`). It never decides what a role may see: costs, stock figures,
 * flags and notes each render only when the server sent them.
 */
export function RunDrawerBody({ run, onOpenRun }: RunDrawerBodyProps) {
  const status = drawerStatus(run);
  const stockWarning = stockWarningSentence(run);
  const gap = run.flags ? yieldGapSentence(run) : null;
  const said = yieldReasonWords(run);
  const showTimeline = run.timeline.length > 1 || run.replaces !== null || run.replacedBy !== null;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        <div className="flex w-[130px] shrink-0 flex-col gap-1">
          <span className={label}>When</span>
          <span className="font-wds-sans text-wds-body-sm leading-[18px] text-wds-text-ink">{formatWhen(run.at)}</span>
        </div>
        <div className="flex min-w-[150px] flex-1 flex-col gap-1">
          <span className={label}>Recorded by</span>
          <span className="font-wds-sans text-wds-body-sm leading-[18px] text-wds-text-ink">
            {run.by.name} · {run.by.roleLabel}
          </span>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <span className={label}>Status</span>
          <StatusDot tone={status.tone}>{status.label}</StatusDot>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border border-wds-border bg-wds-neutral-50 px-4 py-[14px]">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span className={label}>Output produced</span>
          <span className="truncate font-wds-sans text-wds-section font-semibold leading-[18px] text-wds-text-ink">{run.outputName}</span>
        </div>
        <span className="shrink-0 font-wds-sans text-[20px] font-semibold leading-6 text-wds-text-ink">{withUnit(run.made, run.unit)}</span>
      </div>

      <InputsTable run={run} />

      {stockWarning || gap || said ? (
        <div className="flex flex-col gap-2">
          {stockWarning ? <Note tone="warning">{stockWarning}</Note> : null}
          {gap ? <Note tone="info">{gap}</Note> : null}
          {said ? (
            <div className="flex items-center justify-between gap-3 border border-wds-border px-3 py-2.5">
              <span className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{saidWho(run)}</span>
              <span className="border border-wds-espresso-200 bg-wds-espresso-50 px-[9px] py-[3px] font-wds-sans text-wds-caption font-medium leading-4 text-wds-espresso-700">{said}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {run.cancellation ? (
        <Note tone="error">
          Cancelled: {reasonWords(run.cancellation.reason)}
          {run.cancellation.note ? ` (${run.cancellation.note})` : ''}. By {run.cancellation.by.name}, {formatWhen(run.cancellation.at)}.
        </Note>
      ) : null}

      {run.correction ? (
        <div className="flex flex-col gap-2">
          <Note tone="info">
            Corrected: {reasonWords(run.correction.reason)}
            {run.correction.note ? ` (${run.correction.note})` : ''}. By {run.correction.by.name}, {formatWhen(run.correction.at)}.
          </Note>
          {run.correction.changed.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1 border border-wds-border p-3 font-wds-sans text-wds-body-sm text-wds-text-ink">
              {run.correction.changed.map((row) => (
                <li key={row.itemName} className="flex justify-between gap-3">
                  <span className="truncate">{row.itemName}</span>
                  <span className="shrink-0 text-wds-text-copy-muted">
                    {row.was === null ? '—' : withUnit(row.was, row.unit)} → {row.now === null ? '—' : withUnit(row.now, row.unit)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {showTimeline ? (
        <section aria-label="History of this run" className="flex flex-col gap-2">
          <h3 className={label}>History</h3>
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
            {run.timeline.map((entry) => (
              <li key={`${entry.at}-${entry.text}`} className="flex gap-3 font-wds-sans text-wds-body-sm text-wds-text-ink">
                <span className="w-[96px] shrink-0 font-wds-mono text-wds-caption text-wds-text-copy-muted">{formatWhen(entry.at)}</span>
                <span className="min-w-0">{entry.text}</span>
              </li>
            ))}
          </ol>
          {run.replaces || run.replacedBy ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {run.replaces ? (
                <button type="button" disabled={!onOpenRun} onClick={() => onOpenRun?.(run.replaces!.id)} className="font-wds-sans text-wds-body-sm font-medium text-wds-primary underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring max-sm:min-h-11">
                  Replaces {run.replaces.reference}
                </button>
              ) : null}
              {run.replacedBy ? (
                <button type="button" disabled={!onOpenRun} onClick={() => onOpenRun?.(run.replacedBy!.id)} className="font-wds-sans text-wds-body-sm font-medium text-wds-primary underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring max-sm:min-h-11">
                  Replaced by {run.replacedBy.reference}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
