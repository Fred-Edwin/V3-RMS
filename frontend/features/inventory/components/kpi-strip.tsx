import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * KPI Strip + KPI Stat Cell — Item Catalog dashboard stat row, desktop +
 * mobile. Reference: Paper page `15W-0` (Shells & Primitives), node
 * `1QN-0` (desktop specimen) / Milestone One page `B-0`, node `TMQ-0`
 * (mobile specimen, "1m · Item catalog").
 *
 * Only the genuinely actionable number gets an accent color — everything
 * else stays ink (confirmed per-cell via `get_computed_styles`: "SKUs
 * tracked" is plain ink even though it's the first cell, "Below reorder"
 * is `accent-strong`, "Expiring" is `warning-fg`).
 */

export type KpiTone = 'ink' | 'accent' | 'warning' | 'error';

const toneClass: Record<KpiTone, string> = {
  ink: 'text-wds-text-ink',
  accent: 'text-wds-accent-strong',
  warning: 'text-wds-warning-fg',
  error: 'text-wds-error-fg',
};

export interface KpiCellData {
  key: string;
  label: string;
  value: string;
  tone?: KpiTone;
  /** Plain caption text below the value (e.g. "4 critical"). Mutually exclusive with `trend`. */
  detail?: string;
  /** Dot + colored caption (e.g. "+4.2% vs last count", success-toned). */
  trend?: { tone: 'success' | 'warning' | 'error'; label: string };
}

const trendDotClass: Record<'success' | 'warning' | 'error', string> = {
  success: 'bg-wds-success-fg',
  warning: 'bg-wds-warning-fg',
  error: 'bg-wds-error-fg',
};
const trendTextClass: Record<'success' | 'warning' | 'error', string> = {
  success: 'text-wds-success-fg',
  warning: 'text-wds-warning-fg',
  error: 'text-wds-error-fg',
};

/* ------------------------------------------------------------- Desktop */

export interface KpiStripProps {
  cells: KpiCellData[];
  className?: string;
}

/**
 * Desktop KPI Strip — joined cells, one shared border/radius, vertical
 * divider between cells, `wds-gradient-surface-raise` fill. Reference:
 * `1QN-0`.
 */
export function KpiStrip({ cells, className }: KpiStripProps) {
  return (
    <div
      className={cn(
        'flex overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface',
        className
      )}
    >
      {cells.map((cell, i) => (
        <div
          key={cell.key}
          className={cn(
            'flex grow basis-0 flex-col gap-wds-1.5 bg-wds-gradient-surface-raise p-wds-4',
            i < cells.length - 1 && 'border-r border-wds-border'
          )}
        >
          <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">
            {cell.label}
          </span>
          <span className={cn('font-wds-mono text-wds-kpi', toneClass[cell.tone ?? 'ink'])}>
            {cell.value}
          </span>
          {cell.trend ? (
            <span className="inline-flex items-center gap-[5px]">
              <span className={cn('size-[5px] shrink-0 rounded-wds-full', trendDotClass[cell.trend.tone])} />
              <span className={cn('font-wds-sans text-wds-caption', trendTextClass[cell.trend.tone])}>
                {cell.trend.label}
              </span>
            </span>
          ) : cell.detail ? (
            <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{cell.detail}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- Mobile */

export interface KpiRowProps {
  cells: Pick<KpiCellData, 'key' | 'label' | 'value' | 'tone'>[];
  className?: string;
}

/**
 * Mobile KPI row — discrete bordered cells (not joined), each its own card.
 * Reference: `TMQ-0`.
 */
export function KpiRow({ cells, className }: KpiRowProps) {
  return (
    <div className={cn('flex gap-wds-2.5', className)}>
      {cells.map((cell) => (
        <div
          key={cell.key}
          className="flex grow basis-0 flex-col gap-1 rounded-wds-md border border-wds-border bg-wds-surface p-wds-3"
        >
          <span className="font-wds-mono text-wds-kpi-label-sm uppercase text-wds-text-copy-muted">
            {cell.label}
          </span>
          <span className={cn('font-wds-mono text-wds-kpi-sm', toneClass[cell.tone ?? 'ink'])}>
            {cell.value}
          </span>
        </div>
      ))}
    </div>
  );
}
