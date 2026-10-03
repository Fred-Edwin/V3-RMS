import * as React from 'react';

import { cn } from '@/lib/cn';
import type { AgingBucketTone } from '@/features/inventory/purchasing/components/aging-bucket-cell';

/**
 * "What we owe" bucket panel — Supplier detail (VND-0). Genuinely new this
 * milestone (04-components.md Milestone Two #7). Four visible columns
 * (merges 61-90 and 90+ into one "60+ DAYS" column for display, plan §7
 * Q4) over the same underlying five-bucket data item 6's table uses — never
 * a separate four-bucket calculation; the merge happens only when
 * formatting the `sixtyPlus` prop passed in (sum of 61-90 + 90+ by the
 * caller), not inside this component. Reference: `VND-0`, panel node
 * `VQ2-0`.
 *
 * Zero-value cell tone here is Paper-verified as `text-faint` (a plain
 * "nothing here" gray), a genuine difference from item 6's aging table,
 * where an empty bucket still carries its column's warning/error tone —
 * confirmed independently by reading `VQ2-0` directly, not assumed to
 * match the table's convention. Modeled as `tone` applying only when the
 * value is non-empty; an empty value always renders `text-faint`.
 */
export interface AgingBucketPanelCell {
  label: string;
  amountLabel: string;
  /** Empty ("–") cells always render text-faint regardless of tone. */
  tone: AgingBucketTone;
  emphasized?: boolean;
  highlighted?: boolean;
}

export interface AgingBucketPanelProps {
  current: AgingBucketPanelCell;
  oneToThirty: AgingBucketPanelCell;
  thirtyOneToSixty: AgingBucketPanelCell;
  sixtyPlus: AgingBucketPanelCell;
  outstanding: AgingBucketPanelCell;
  className?: string;
}

const toneClass: Record<AgingBucketTone, string> = {
  neutral: 'text-wds-text-ink',
  warning: 'text-wds-warning-fg',
  error: 'text-wds-error-fg',
};

function Cell({ cell, highlighted }: { cell: AgingBucketPanelCell; highlighted?: boolean }) {
  const isEmpty = cell.amountLabel === '–' || cell.amountLabel === '—';
  return (
    <div
      className={cn(
        'flex grow basis-0 flex-col gap-wds-1 border-r border-wds-border px-wds-3.5 py-wds-3 last:border-r-0',
        highlighted && 'bg-wds-neutral-50'
      )}
    >
      <span className="font-wds-mono text-wds-field-label text-wds-text-copy-muted">{cell.label}</span>
      <span
        className={cn(
          'font-wds-mono text-[16px] leading-5',
          isEmpty ? 'text-wds-text-faint' : toneClass[cell.tone],
          cell.emphasized && 'font-medium'
        )}
      >
        {cell.amountLabel}
      </span>
    </div>
  );
}

export function AgingBucketPanel({
  current,
  oneToThirty,
  thirtyOneToSixty,
  sixtyPlus,
  outstanding,
  className,
}: AgingBucketPanelProps) {
  return (
    <div className={cn('flex overflow-hidden rounded-wds-md border border-wds-border', className)}>
      <Cell cell={current} />
      <Cell cell={oneToThirty} />
      <Cell cell={thirtyOneToSixty} />
      <Cell cell={sixtyPlus} />
      <Cell cell={outstanding} highlighted />
    </div>
  );
}
