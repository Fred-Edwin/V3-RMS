import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Bundling checkbox list — Record supplier invoice (UZJ-0, "RECEIPTS TO
 * BUNDLE") and Record supplier payment (V7Z-0, "INVOICES TO ALLOCATE").
 * Genuinely new this milestone (04-components.md Milestone Two #4). Both
 * screens use the identical pattern (checkbox rows + a running total that
 * recomputes live) — built once here, consumed by both. Reference: `UZJ-0`,
 * panel node `V0L-0` (checkbox rows) + `V0I-0` (running-total row).
 */
export interface BundleRow {
  id: string;
  title: string;
  subtitle: string;
  amountLabel: string;
  checked: boolean;
}

export interface BundleCheckboxListProps {
  title: string;
  rows: BundleRow[];
  onToggle: (id: string) => void;
  className?: string;
}

export function BundleCheckboxList({ title, rows, onToggle, className }: BundleCheckboxListProps) {
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-wds-md border border-wds-border', className)}>
      <div className="flex h-[30px] shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-3">
        <span className="grow font-wds-mono text-wds-table-label text-wds-text-ink">{title}</span>
      </div>
      {rows.map((row, i) => (
        <button
          key={row.id}
          type="button"
          onClick={() => onToggle(row.id)}
          className={cn(
            'flex h-11 shrink-0 items-center gap-wds-2.5 px-wds-3 text-left transition-colors hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wds-primary active:bg-wds-neutral-100',
            i < rows.length - 1 && 'border-b border-wds-neutral-100'
          )}
        >
          <span
            aria-hidden
            className={cn(
              'size-[14px] shrink-0 rounded-wds-sm border-[1.5px] border-solid',
              row.checked ? 'border-wds-primary bg-wds-primary' : 'border-wds-border-strong bg-transparent'
            )}
          />
          <span className="flex grow flex-col">
            <span className={cn('font-wds-sans text-wds-body-sm', row.checked ? 'text-wds-text-ink' : 'text-wds-text-copy-muted')}>
              {row.title}
            </span>
            <span className="font-wds-sans text-wds-field-label text-wds-text-copy-muted">{row.subtitle}</span>
          </span>
          <span className={cn('font-wds-mono text-wds-caption', row.checked ? 'text-wds-text-ink' : 'text-wds-text-copy-muted')}>
            {row.amountLabel}
          </span>
        </button>
      ))}
    </div>
  );
}

export interface BundleRunningTotalProps {
  label: string;
  amountLabel: string;
  className?: string;
}

/** The "Our figure (N receipts selected)" / equivalent running total row below the checkbox list. */
export function BundleRunningTotal({ label, amountLabel, className }: BundleRunningTotalProps) {
  return (
    <div className={cn('flex items-center justify-between rounded-wds-md bg-wds-neutral-50 px-wds-3 py-wds-2.5', className)}>
      <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{label}</span>
      <span className="font-wds-mono text-wds-body text-wds-text-ink">{amountLabel}</span>
    </div>
  );
}
