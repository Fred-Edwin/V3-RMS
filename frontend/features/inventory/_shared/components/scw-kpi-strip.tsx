'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import type { KpiCell } from '../types/wire';

/**
 * The KPI strip of the Counting, Stock and Waste desktop screens (Paper `1X6I-0` and the strips on steps 9, 21, 26, 27, 28):
 * joined cells with a 2 px top edge coloured by the cell's tone (amber for a thing to do, red for a problem, a quiet grey
 * otherwise), a mono caps label, a mono 28 px value and a caption. The server decides the words (`KpiCell`); this only draws them.
 * A cell the server marks with `filter` is a one-tap filter: a button that calls `onFilter` (the same chip the table has), so
 * nothing here is a dead control. Cells without a filter are plain text.
 */
const TOP: Record<KpiCell['tone'], string> = {
  NEUTRAL: 'border-t-wds-border',
  WARN: 'border-t-wds-selected-edge',
  ALERT: 'border-t-wds-error-fg',
};
const LABEL: Record<KpiCell['tone'], string> = {
  NEUTRAL: 'text-wds-text-secondary',
  WARN: 'text-wds-warning-fg',
  ALERT: 'text-wds-error-fg',
};

export interface ScwKpiStripProps {
  cells: KpiCell[];
  /** Called with the cell's `filter` value when a filter cell is pressed. */
  onFilter?: (filter: string) => void;
  /** The filter currently applied, so its cell reads as pressed. */
  activeFilter?: string;
  /**
   * `summary` is the Counts / Stock strip (28 px values, a 4 px cap above them). `compact` is the review strip of step 9
   * (`1XIC-0`: 24 px values coloured by the cell's tone, tighter cells).
   */
  variant?: 'summary' | 'compact';
  /** Cells (by key) drawn with a green top edge and label: "Applied to stock" on a signed count (step 15). */
  successKeys?: string[];
  className?: string;
}

const VALUE_TONE: Record<KpiCell['tone'], string> = {
  NEUTRAL: 'text-wds-text-ink',
  WARN: 'text-wds-warning-fg',
  ALERT: 'text-wds-error-fg',
};

export function ScwKpiStrip({ cells, onFilter, activeFilter, variant = 'summary', successKeys = [], className }: ScwKpiStripProps) {
  const compact = variant === 'compact';
  return (
    <div className={cn('flex flex-wrap border border-wds-border bg-wds-surface', className)} role="group" aria-label="Summary">
      {cells.map((cell, i) => {
        const interactive = Boolean(cell.filter && onFilter);
        const body = (
          <>
            <span className={cn('font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em]', successKeys.includes(cell.key) ? 'text-wds-success-fg' : LABEL[cell.tone])}>{cell.label}</span>
            <span
              className={cn(
                'font-wds-mono',
                compact ? 'text-[24px] leading-[30px]' : 'text-wds-kpi',
                compact ? VALUE_TONE[cell.tone] : cell.filter ? 'text-wds-text-ink' : 'text-wds-text-secondary',
              )}
            >
              {cell.value}
            </span>
            {cell.caption ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{cell.caption}</span> : null}
          </>
        );
        const base = cn(
          'flex min-w-[160px] grow basis-0 flex-col border-t-2 px-4 text-left',
          compact ? 'gap-0.5 py-3' : 'gap-[3px] py-3.5',
          successKeys.includes(cell.key) ? 'border-t-wds-success-fg' : TOP[cell.tone],
          i < cells.length - 1 && 'border-r border-r-wds-border',
        );
        return interactive ? (
          <button
            key={cell.key}
            type="button"
            aria-pressed={activeFilter === cell.filter}
            onClick={() => onFilter?.(cell.filter ?? '')}
            className={cn(base, 'outline-none transition-colors duration-100 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-ring)] [@media(hover:hover)]:hover:bg-wds-neutral-50 active:bg-wds-neutral-100')}
          >
            {body}
          </button>
        ) : (
          <div key={cell.key} className={base}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** Four placeholder cells with the strip's own height, so nothing jumps when the numbers arrive. */
export function ScwKpiStripSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex border border-wds-border bg-wds-surface" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn('flex min-w-[200px] grow basis-0 flex-col gap-[3px] border-t-2 border-t-wds-border px-4 py-3.5', i < count - 1 && 'border-r border-r-wds-border')}>
          <span className="my-px h-2.5 w-24 animate-pulse bg-wds-neutral-100 motion-reduce:animate-none" />
          <span className="font-wds-mono text-wds-kpi text-wds-text-faint">—</span>
          <span className="my-[2px] h-3 w-32 animate-pulse bg-wds-neutral-100 motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
