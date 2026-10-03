import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * The four-number strip on the Item catalog (Paper step 01, "KPI strip").
 * A cell that needs attention carries a warning top edge and an arrow, and is
 * a one-tap filter for the list below (decisions doc: assumption, built as
 * drawn). Cells without `onSelect` are plain numbers.
 */
export interface CatalogKpiCell {
  key: string;
  label: string;
  value: string;
  sub: string;
  /** Warning-toned top edge, value and arrow — a number that needs attention. */
  attention?: boolean;
  onSelect?: () => void;
  /** The list below is currently filtered to this cell. */
  active?: boolean;
}

function CellBody({ cell }: { cell: CatalogKpiCell }) {
  return (
    <>
      <span className="flex items-center justify-between">
        <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">{cell.label.toUpperCase()}</span>
        {cell.attention ? (
          <span aria-hidden className="font-wds-sans text-[12px] leading-3 text-wds-text-muted">
            →
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          'font-wds-sans text-[30px] font-semibold leading-[34px] tracking-[-0.025em]',
          cell.attention ? 'text-wds-warning-fg' : 'text-wds-text-ink'
        )}
      >
        {cell.value}
      </span>
      <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{cell.sub}</span>
    </>
  );
}

export function CatalogKpiStrip({ cells, className }: { cells: CatalogKpiCell[]; className?: string }) {
  return (
    <div className={cn('flex border border-wds-border bg-wds-gradient-surface-raise', className)}>
      {cells.map((cell, i) => {
        const classes = cn(
          'flex grow basis-0 flex-col gap-1.5 border-t-2 px-5 py-4 text-left',
          i < cells.length - 1 && 'border-r border-r-wds-border',
          cell.attention ? 'border-t-wds-warning-fg' : 'border-t-transparent'
        );
        return cell.onSelect ? (
          <button
            key={cell.key}
            type="button"
            onClick={cell.onSelect}
            aria-pressed={cell.active}
            className={cn(
              classes,
              'transition-colors duration-150 hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:shadow-wds-ring motion-safe:active:scale-[0.995]',
              cell.active && 'bg-wds-warning-bg'
            )}
          >
            <CellBody cell={cell} />
          </button>
        ) : (
          <div key={cell.key} className={classes}>
            <CellBody cell={cell} />
          </div>
        );
      })}
    </div>
  );
}
