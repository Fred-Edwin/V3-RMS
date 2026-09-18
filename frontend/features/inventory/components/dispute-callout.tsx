import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Mismatch/dispute callout — Record supplier invoice (UZJ-0). Genuinely new
 * this milestone (04-components.md Milestone Two #5). Warning-toned callout
 * with two action buttons (Hold / Record at billed — open dispute); per
 * plan §3.2 this is the same POST /supplier-invoices endpoint with an
 * optional `dispute` object, Hold being the genuine no-write branch that
 * just closes the drawer — this composite only renders the callout, the
 * write-path decision is the consuming screen's concern.
 * Reference: `UZJ-0`, callout node `UZV-0`.
 */
export interface DisputeCalloutProps {
  title: string;
  description: string;
  onHold: () => void;
  onRecordAtBilled: () => void;
  holdLabel?: string;
  recordAtBilledLabel?: string;
  /**
   * AMENDMENT 2026-09-18 (S8): disables both actions while the consuming
   * screen's request is in flight — prevents a double-submit on
   * "Record at billed" (a real write), not just a UX nicety.
   */
  disabled?: boolean;
  className?: string;
}

export function DisputeCallout({
  title,
  description,
  onHold,
  onRecordAtBilled,
  holdLabel = 'Hold',
  recordAtBilledLabel = 'Record at billed — open dispute',
  disabled,
  className,
}: DisputeCalloutProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-wds-2 rounded-wds-md border border-wds-warning-border bg-wds-warning-bg px-wds-3.5 py-wds-3',
        className
      )}
    >
      <span className="mt-[5px] size-1.5 shrink-0 rounded-wds-full bg-wds-warning-fg" aria-hidden />
      <div className="flex grow flex-col gap-wds-1">
        <p className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{title}</p>
        <p className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{description}</p>
        <div className="mt-wds-1 flex gap-wds-2">
          <button
            type="button"
            onClick={onHold}
            disabled={disabled}
            className="min-w-12 shrink-0 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2.5 py-1 font-wds-sans text-wds-caption text-wds-text-ink transition-colors hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wds-primary active:bg-wds-neutral-100 disabled:pointer-events-none disabled:opacity-60"
          >
            {holdLabel}
          </button>
          <button
            type="button"
            onClick={onRecordAtBilled}
            disabled={disabled}
            className="shrink-0 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2.5 py-1 font-wds-sans text-wds-caption text-wds-text-ink transition-colors hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wds-primary active:bg-wds-neutral-100 disabled:pointer-events-none disabled:opacity-60"
          >
            {recordAtBilledLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
