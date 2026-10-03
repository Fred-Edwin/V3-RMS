'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { formatNumber } from '../../../_shared/components/stock-format';
import { statusLabel, suggestionLine } from '../../lib/department-levels';
import type { RestockLevelRow, RestockStatus } from '../../../types';

const STATUS_TEXT: Record<RestockStatus, string> = {
  OUT: 'text-wds-error-fg',
  LOW: 'text-wds-warning-fg',
  OK: 'text-wds-success-fg',
  NO_LEVEL: 'text-wds-text-copy-muted',
};
const STATUS_DOT: Record<RestockStatus, string> = {
  OUT: 'bg-wds-error-fg',
  LOW: 'bg-wds-warning-fg',
  OK: 'bg-wds-success-fg',
  NO_LEVEL: 'bg-wds-neutral-400',
};

const stepButton =
  'flex h-11 w-[52px] shrink-0 items-center justify-center border border-wds-border-strong bg-wds-surface font-wds-sans text-[22px] leading-7 text-wds-text-ink outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring motion-safe:active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40';

export interface DepartmentLevelCardProps {
  row: RestockLevelRow;
  /** The level on file (null = none yet). */
  saved: string | null;
  /** The level on screen: the saved one, or what the person has stepped to. */
  typed: string | null;
  onStep: (direction: 1 | -1) => void;
}

/**
 * One item on the Department Head's phone: name and unit, status, big − / + around the level, and the
 * suggestion under it (Paper step 27). A changed card turns espresso-tinted and shows "12 → 14".
 */
export const DepartmentLevelCard = React.memo(function DepartmentLevelCard({ row, saved, typed, onStep }: DepartmentLevelCardProps) {
  const changed = saved !== typed;
  const line = suggestionLine(row, saved, typed);
  return (
    <li
      className={cn(
        'flex flex-col gap-2 border px-3.5 py-3 transition-colors duration-150 ease-out',
        changed ? 'border-wds-espresso-200 bg-wds-espresso-50' : 'border-wds-border bg-wds-surface'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-px">
          <span className="font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-text-ink">{row.itemName}</span>
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-copy-muted">
            {row.usageUnit} · on hand {formatNumber(row.onHandQty)}
          </span>
        </div>
        <span className={cn('flex shrink-0 items-center gap-1.5 font-wds-sans text-[13px] leading-4', STATUS_TEXT[row.status])}>
          <span className={cn('size-1.5 rounded-[3px]', STATUS_DOT[row.status])} />
          {statusLabel(row.status)}
        </span>
      </div>
      <div className="flex items-center">
        <button type="button" className={stepButton} onClick={() => onStep(-1)} disabled={typed === null || Number.parseFloat(typed) <= 0} aria-label={`Lower the level for ${row.itemName}`}>
          −
        </button>
        <div
          role="status"
          aria-label={`${row.itemName} level`}
          className={cn(
            'flex h-11 grow items-center justify-center gap-2 bg-wds-surface',
            changed ? 'border-[1.5px] border-wds-primary' : 'border-y border-wds-border-strong'
          )}
        >
          {changed ? (
            <span className="font-wds-mono text-[13px] leading-4 text-wds-text-faint">{saved === null ? 'none' : formatNumber(saved)} →</span>
          ) : null}
          <span className="font-wds-mono text-[20px] font-semibold leading-6 text-wds-text-ink">{typed === null ? '—' : formatNumber(typed)}</span>
        </div>
        <button type="button" className={stepButton} onClick={() => onStep(1)} aria-label={`Raise the level for ${row.itemName}`}>
          +
        </button>
      </div>
      {line ? (
        <p className={cn('font-wds-sans text-[12px] leading-4', line.tone === 'success' ? 'text-wds-success-fg' : 'text-wds-text-copy-muted')}>{line.text}</p>
      ) : null}
    </li>
  );
});
