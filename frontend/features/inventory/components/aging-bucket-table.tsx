import * as React from 'react';

import { cn } from '@/lib/cn';
import { AgingBucketCell, AGING_BUCKET_COLUMNS } from '@/features/inventory/components/aging-bucket-cell';

/**
 * "How overdue" bucket table — Suppliers screen (VGE-0). Genuinely new this
 * milestone (04-components.md Milestone Two #6). Five-column bucket set
 * (CURRENT/1-30/31-60/61-90/90+, plan §7 Q4) built once as
 * `AgingBucketCell`/`AGING_BUCKET_COLUMNS` (aging-bucket-cell.tsx) and
 * shared with item 7's panel — never two separate layouts or two separate
 * bucket calculations. Reference: `VGE-0`, header row `VIY-0`, populated
 * row `VIJ-0` (Kimathi Butchery — the disputed-supplier case).
 */
export interface AgingBucketTableRow {
  id: string;
  supplierName: string;
  disputedCount?: number;
  termsLabel: string;
  lastActivityLabel: string;
  invoiced: string;
  paid: string;
  buckets: Record<string, string>;
  outstanding: string;
}

export interface AgingBucketTableProps {
  rows: AgingBucketTableRow[];
  className?: string;
}

export function AgingBucketTable({ rows, className }: AgingBucketTableProps) {
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-wds-md border border-wds-border', className)}>
      <div className="flex h-[20px] shrink-0 items-center border-b border-wds-border bg-wds-surface px-wds-4">
        <div className="min-w-[180px] grow" />
        <div className="w-[96px] shrink-0" />
        <div className="w-[90px] shrink-0" />
        <div className="w-[312px] shrink-0 pl-wds-2">
          <p className="text-center font-wds-mono text-[9px] leading-3 tracking-[0.08em] text-wds-text-faint">
            — DAYS OVERDUE —
          </p>
        </div>
        <div className="w-[104px] shrink-0" />
      </div>

      <div className="flex h-[30px] shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-4">
        <span className="min-w-[180px] grow font-wds-mono text-wds-table-label text-wds-text-ink">Supplier</span>
        <span className="w-[96px] shrink-0 text-right font-wds-mono text-wds-table-label text-wds-text-ink">Invoiced</span>
        <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-table-label text-wds-text-ink">Paid</span>
        {AGING_BUCKET_COLUMNS.map((col) => (
          <span
            key={col.key}
            className={cn(
              'w-[78px] shrink-0 text-right font-wds-mono text-wds-table-label',
              col.tone === 'neutral' ? 'text-wds-text-ink' : col.tone === 'warning' ? 'text-wds-warning-fg' : 'text-wds-error-fg'
            )}
          >
            {col.label}
          </span>
        ))}
        <span className="w-[104px] shrink-0 text-right font-wds-mono text-wds-table-label text-wds-text-ink">Outstanding</span>
      </div>

      {rows.map((row) => (
        <div key={row.id} className="flex min-h-[52px] items-center border-b border-wds-neutral-100 px-wds-4 last:border-b-0">
          <div className="flex min-w-[180px] grow flex-col items-start gap-[2px] py-wds-2">
            <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{row.supplierName}</span>
            {row.disputedCount ? (
              <span className="flex items-center gap-wds-1 rounded-wds-sm border border-wds-error-border bg-wds-error-bg px-wds-1.5 py-px">
                <span className="size-[5px] shrink-0 rounded-wds-full bg-wds-error-fg" aria-hidden />
                <span className="font-wds-sans text-[10px] leading-3 text-wds-error-fg">{row.disputedCount} disputed</span>
              </span>
            ) : null}
            <span className="font-wds-sans text-wds-field-label text-wds-info-fg">
              {row.termsLabel} · last {row.lastActivityLabel}
            </span>
          </div>
          <span className="w-[96px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-copy-muted">{row.invoiced}</span>
          <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-copy-muted">{row.paid}</span>
          {AGING_BUCKET_COLUMNS.map((col) => (
            <div key={col.key} className="w-[78px] shrink-0 text-right">
              <AgingBucketCell value={row.buckets[col.key] ?? '–'} tone={col.tone} />
            </div>
          ))}
          <span className="w-[104px] shrink-0 text-right font-wds-mono text-wds-body-sm font-medium text-wds-text-ink">
            {row.outstanding}
          </span>
        </div>
      ))}
    </div>
  );
}
