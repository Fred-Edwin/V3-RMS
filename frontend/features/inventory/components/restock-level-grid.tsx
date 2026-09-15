import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Restock Level Grid — Restock Levels screen (Central Store + department),
 * desktop drawer body (440px drawer — a 4th distinct width found this
 * milestone, confirmed via `get_computed_styles` on `T53-0`) + mobile
 * full-screen route. Reference: `T52-0`/`T5F-0` (desktop) / `TLX-0`/`U03-0`
 * (mobile) / `TD1-0` (department, mobile-only per the milestone doc).
 *
 * Below-restock-level tone is a genuine, Paper-drawn platform difference —
 * confirmed by reading each independently rather than assuming they match:
 * desktop uses `--color-warning-fg` (amber, `T5S-0`), mobile uses
 * `--color-error-fg` (red, `U0E-0`).
 */
export interface RestockLevelRow {
  id: string;
  name: string;
  unit: string;
  onHand: number;
  restockLevel: number;
}

export interface RestockLevelGridProps {
  variant: 'desktop' | 'mobile';
  rows: RestockLevelRow[];
  onRestockLevelChange: (id: string, value: string) => void;
  className?: string;
}

const belowLevelToneClass = {
  desktop: 'text-wds-warning-fg',
  mobile: 'text-wds-error-fg',
} as const;

export function RestockLevelGrid({
  variant,
  rows,
  onRestockLevelChange,
  className,
}: RestockLevelGridProps) {
  const isMobile = variant === 'mobile';

  if (isMobile) {
    return (
      <div className={cn('flex flex-col', className)}>
        <div className="flex items-center justify-between px-wds-3 py-2.5">
          <span className="font-wds-mono text-wds-mono-sm uppercase tracking-[0.06em] text-wds-text-ink">Item</span>
          <div className="flex items-center gap-wds-4">
            <span className="font-wds-mono text-wds-mono-sm uppercase tracking-[0.06em] text-wds-text-ink">
              On hand
            </span>
            <span className="font-wds-mono text-wds-mono-sm uppercase tracking-[0.06em] text-wds-text-ink">
              Restock level
            </span>
          </div>
        </div>
        {rows.map((row) => {
          const below = row.onHand < row.restockLevel;
          return (
            <div key={row.id} className="flex items-center justify-between border-b border-wds-border p-wds-3">
              <div className="flex flex-col">
                <span className="font-wds-sans text-wds-body font-medium text-wds-text-ink">{row.name}</span>
                <span className="font-wds-sans text-wds-caption text-wds-text-copy-faint">{row.unit}</span>
              </div>
              <div className="flex items-center gap-wds-4">
                <span
                  className={cn(
                    'font-wds-mono text-wds-body',
                    below ? belowLevelToneClass.mobile : 'text-wds-text-ink'
                  )}
                >
                  {row.onHand}
                </span>
                <input
                  value={row.restockLevel}
                  onChange={(e) => onRestockLevelChange(row.id, e.target.value)}
                  className="h-8 w-14 shrink-0 rounded-wds-md border border-wds-border-strong text-center font-wds-mono text-wds-body text-wds-text-ink focus-visible:outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring"
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-wds-md border border-wds-border', className)}>
      <div className="flex h-[30px] shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-3">
        <span className="flex-1 font-wds-mono text-wds-mono-sm uppercase tracking-[0.06em] text-wds-text-ink">
          Item
        </span>
        <span className="w-20 shrink-0 text-right font-wds-mono text-wds-mono-sm uppercase tracking-[0.06em] text-wds-text-ink">
          On hand
        </span>
        <span className="w-[100px] shrink-0 text-center font-wds-mono text-wds-mono-sm uppercase tracking-[0.06em] text-wds-text-ink">
          Restock level
        </span>
      </div>
      {rows.map((row) => {
        const below = row.onHand < row.restockLevel;
        return (
          <div
            key={row.id}
            className="flex h-[46px] shrink-0 items-center border-b border-wds-neutral-100 px-wds-3 last:border-b-0"
          >
            <div className="flex flex-1 flex-col gap-px">
              <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{row.name}</span>
              <span className="font-wds-sans text-wds-field-label text-wds-text-copy-faint">{row.unit}</span>
            </div>
            <span
              className={cn(
                'w-20 shrink-0 text-right font-wds-mono text-wds-body-sm',
                below ? belowLevelToneClass.desktop : 'text-wds-text-copy-muted'
              )}
            >
              {row.onHand}
            </span>
            <div className="flex w-[100px] shrink-0 justify-center">
              <input
                value={row.restockLevel}
                onChange={(e) => onRestockLevelChange(row.id, e.target.value)}
                className="h-[30px] w-[72px] shrink-0 rounded-wds-sm border border-wds-border-strong text-center font-wds-mono text-wds-body-sm text-wds-text-ink focus-visible:outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The helper-note callout band (dot + muted caption) shown below the grid.
 * Reference: `T5A-0` (desktop) / `U0R-0` (mobile) — same structure both
 * places, only spacing differs slightly (`py-10/px-12` desktop vs.
 * `p-12` mobile).
 */
export function RestockLevelHelperNote({
  variant,
  children,
  className,
}: {
  variant: 'desktop' | 'mobile';
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex gap-wds-2 rounded-wds-md bg-wds-neutral-50',
        variant === 'desktop' ? 'py-wds-2.5 px-wds-3' : 'border border-wds-border p-wds-3',
        className
      )}
    >
      <span className="mt-[5px] size-1.5 shrink-0 rounded-wds-full bg-wds-neutral-400" aria-hidden />
      <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{children}</span>
    </div>
  );
}
