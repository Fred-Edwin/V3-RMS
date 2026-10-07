import * as React from 'react';

import { cn } from '@/lib/cn';
import { formatClock, formatQuantity, formatWhen } from '../../_shared/lib/prep-format';
import type { RunDetail } from '../../_shared/types/prep-contract';
import { reasonLabel } from '../lib/fix-logic';

const label = 'font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em]';
const money = (value: string, digits = 0): string => `KES ${Number(value).toLocaleString('en-KE', { maximumFractionDigits: digits })}`;

export interface CompareRow {
  name: string;
  was: string | null;
  now: string | null;
  unit: string;
  costNow?: string;
  changed: boolean;
}

/**
 * What the drawer's WHAT CHANGED table lists: every line of the corrected run with what it was and what it is now (Paper draws the
 * unchanged ones too), then anything the correction dropped, then the made figure. Built from the run's own lines plus the
 * server's `changed` rows, so it needs nothing beyond the frozen contract.
 */
export const compareRows = (run: RunDetail): CompareRow[] => {
  const correction = run.correction;
  if (!correction) return [];
  const changedBy = new Map(correction.changed.map((row) => [row.itemName, row]));
  const rows: CompareRow[] = run.inputs.map((line) => {
    const row = changedBy.get(line.itemName);
    return {
      name: line.itemName,
      was: row ? row.was : line.quantity,
      now: line.quantity,
      unit: line.unit,
      ...(line.lineCost !== undefined ? { costNow: line.lineCost } : {}),
      changed: row !== undefined,
    };
  });
  for (const row of correction.changed) {
    if (row.now === null) rows.push({ name: row.itemName, was: row.was, now: null, unit: row.unit, changed: true });
  }
  const made = changedBy.get(run.outputName);
  rows.push({ name: run.outputName, was: made ? made.was : run.made, now: run.made, unit: run.unit, changed: made !== undefined });
  return rows;
};

const dotTone = (text: string): string => (text.startsWith('Recorded') ? 'bg-wds-success-fg' : text.startsWith('Cancelled') ? 'bg-wds-error-fg' : 'bg-wds-warning-fg');

/** "12 Oct, 13:15" (Paper puts a comma after the date in the amber note). */
const noteWhen = (iso: string): string => formatWhen(iso).replace(/^(\d+ \w+) /, '$1, ');

const amount = (value: string | null, unit: string): string => (value === null ? '—' : `${formatQuantity(value)} ${unit}`);

/**
 * The corrected run's side-by-side (Paper step 17 `87R-0`): the amber "Corrected by" note, WHAT CHANGED (was, now, cost now), the
 * output unit cost before and after, and the history of the run. It is the body of the manager's run drawer; the drawer
 * (Slice 4) owns the header, the footer buttons and "Mark reviewed". Costs show only when the server sent them (`prep.see_costs`).
 */
export function CorrectedCompare({ run, className }: { run: RunDetail; className?: string }) {
  const correction = run.correction;
  if (!correction) {
    return <p className={cn('font-wds-sans text-wds-body-sm text-wds-text-copy-muted', className)}>This run was recorded as it stands. It is not a correction.</p>;
  }
  const rows = compareRows(run);
  const showCosts = correction.unitCostAfter !== undefined;
  const replaced = run.replaces;
  const unitChanged = showCosts && correction.unitCostBefore !== undefined && Number(correction.unitCostBefore) !== Number(correction.unitCostAfter);

  return (
    <div className={cn('flex flex-col gap-[18px]', className)}>
      <div className="flex flex-col gap-1.5 border border-wds-warning-border bg-wds-warning-bg px-[14px] py-3 font-wds-sans text-wds-warning-fg">
        <span className="text-wds-body-sm font-medium leading-4">
          Corrected by {correction.by.name} · {noteWhen(correction.at)}
        </span>
        <span className="text-wds-body-sm leading-[18px]">
          {replaced ? `Replaces ${replaced.reference} (${formatClock(replaced.at).replace(/^0/, '')}). ` : ''}Reason: {reasonLabel(correction.reason).toLowerCase()}.{correction.note ? ` ${correction.note}` : ''}
        </span>
      </div>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="h-8 border-b border-wds-text-ink">
            <th scope="col" className={cn(label, 'font-normal text-wds-text-ink')}>
              What changed
            </th>
            <th scope="col" className={cn(label, 'w-[90px] text-right font-normal text-wds-text-ink')}>
              Was
            </th>
            <th scope="col" className={cn(label, 'w-[90px] text-right font-normal text-wds-text-ink')}>
              Now
            </th>
            {showCosts ? (
              <th scope="col" className={cn(label, 'w-[90px] text-right font-normal text-wds-text-ink')}>
                Cost now
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="h-11 border-b border-wds-border">
              <th scope="row" className="min-w-0 break-words pr-2 text-left font-wds-sans text-wds-body-sm font-normal leading-4 text-wds-text-ink">
                {row.name}
              </th>
              <td className="text-right font-wds-sans text-wds-body-sm leading-4 text-wds-text-copy-muted">{amount(row.was, row.unit)}</td>
              <td className={cn('text-right font-wds-sans text-wds-body-sm leading-4 text-wds-text-ink', row.changed && 'font-medium')}>{amount(row.now, row.unit)}</td>
              {showCosts ? <td className="text-right font-wds-sans text-wds-body-sm leading-4 text-wds-text-copy-muted">{row.costNow !== undefined ? money(row.costNow) : ''}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>

      {showCosts && correction.unitCostBefore !== undefined && correction.unitCostAfter !== undefined ? (
        <div className="flex items-center justify-between gap-wds-4 border border-wds-border bg-wds-neutral-50 px-4 py-[14px]">
          <div className="flex flex-col gap-[3px]">
            <span className={cn(label, 'text-wds-text-copy-muted')}>Output unit cost</span>
            <span className="font-wds-sans text-wds-caption leading-4 text-wds-text-copy-muted">Cost of one {run.unit === 'portions' ? 'portion' : run.unit}, before and after</span>
          </div>
          <span className="shrink-0 font-wds-mono text-wds-section leading-[18px] text-wds-text-ink">
            {unitChanged ? (
              <>
                {money(correction.unitCostBefore, 2)} <span aria-label="to">→</span> {money(correction.unitCostAfter, 2)}
              </>
            ) : (
              <>{money(correction.unitCostAfter, 2)} (no change)</>
            )}
          </span>
        </div>
      ) : null}

      <section aria-label="History of this run" className="border border-wds-border">
        <h3 className={cn(label, 'border-b border-wds-border px-[14px] py-[10px] font-normal text-wds-text-copy-muted')}>History of this run</h3>
        <ol>
          {run.timeline.map((entry) => (
            <li key={`${entry.at}-${entry.text}`} className="flex items-center gap-3 border-b border-wds-border px-[14px] py-[10px] last:border-b-0">
              <span aria-hidden className={cn('size-[7px] shrink-0 rounded-full', dotTone(entry.text))} />
              <span className="min-w-0 flex-1 break-words font-wds-sans text-wds-body-sm leading-4 text-wds-text-ink">{entry.text}</span>
              <span className="shrink-0 font-wds-mono text-wds-caption text-wds-text-copy-muted">{formatClock(entry.at)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
