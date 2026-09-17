import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Mixed-type Inbound/History row — Purchasing hub (U7V-0). Genuinely new
 * this milestone (04-components.md Milestone Two #8). Renders an
 * `ExpectedDelivery` row and a `GoodsReceipt` row in the same table with
 * different fields per type (estimate rows show `~KES`, receipt rows show
 * exact amounts and are hidden entirely from `STORE_ATTENDANT`, plan §3.1)
 * — a discriminated-union row renderer, not two separate tables glued
 * together. Reference: `U7V-0`, expected-delivery row `UAQ-0` (Samrat Ltd,
 * "Awaiting delivery") and goods-receipt row `U9K-0` (GRN-1042, "Received —
 * invoice pending"). The three status-tone variants (neutral/error/info)
 * were each read independently off their own row rather than assumed —
 * `get_computed_styles` on the "Overdue" row confirmed `error-fg`.
 */
export type PurchasingRowStatusTone = 'neutral' | 'error' | 'info';

interface PurchasingRowAction {
  label: string;
  emphasized?: boolean;
  onClick: () => void;
}

export type PurchasingHistoryRow =
  | {
      type: 'expectedDelivery';
      id: string;
      supplierName: string;
      paymentTermsLabel: string;
      detailLabel: string;
      ageLabel: string;
      statusLabel: string;
      statusTone: PurchasingRowStatusTone;
      actions: [PurchasingRowAction, PurchasingRowAction];
    }
  | {
      type: 'goodsReceipt';
      id: string;
      title: string;
      subtitleLabel: string;
      detailLabel: string;
      ageLabel: string;
      statusLabel: string;
      statusTone: PurchasingRowStatusTone;
      actions: [PurchasingRowAction, PurchasingRowAction];
    };

const toneDotClass: Record<PurchasingRowStatusTone, string> = {
  neutral: 'bg-wds-neutral-500',
  error: 'bg-wds-error-fg',
  info: 'bg-wds-info-fg',
};

const toneTextClass: Record<PurchasingRowStatusTone, string> = {
  neutral: 'text-wds-neutral-600',
  error: 'text-wds-error-fg',
  info: 'text-wds-info-fg',
};

export function PurchasingHistoryRowView({ row, className }: { row: PurchasingHistoryRow; className?: string }) {
  const titleLine = row.type === 'expectedDelivery' ? row.supplierName : row.title;
  const subtitleLine = row.type === 'expectedDelivery' ? row.paymentTermsLabel : row.subtitleLabel;

  return (
    <div
      className={cn(
        'flex h-14 shrink-0 items-center border-b border-wds-neutral-100 px-wds-4 transition-colors hover:bg-wds-surface-sunken',
        className
      )}
    >
      <div className="flex w-[200px] min-w-0 shrink-0 flex-col gap-px">
        <span className="truncate font-wds-sans text-wds-body-sm font-medium text-wds-text-ink" title={titleLine}>
          {titleLine}
        </span>
        <span className="truncate font-wds-sans text-wds-caption text-wds-text-copy-muted" title={subtitleLine}>
          {subtitleLine}
        </span>
      </div>
      <span className="min-w-0 grow truncate font-wds-sans text-wds-body-sm text-wds-text-ink" title={row.detailLabel}>
        {row.detailLabel}
      </span>
      <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-copy-muted">{row.ageLabel}</span>
      <div className="flex w-[150px] shrink-0 items-center gap-wds-1.5 pl-wds-6">
        <span className={cn('size-1.5 shrink-0 rounded-wds-full', toneDotClass[row.statusTone])} aria-hidden />
        <span className={cn('font-wds-sans text-wds-caption', toneTextClass[row.statusTone])}>{row.statusLabel}</span>
      </div>
      <div className="flex w-[150px] shrink-0 justify-end gap-wds-1.5">
        {row.actions.map((action, i) => (
          <button
            key={i}
            type="button"
            onClick={action.onClick}
            className={cn(
              'flex h-7 items-center rounded-wds-sm border border-wds-border-strong bg-wds-surface font-wds-sans text-wds-caption outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring active:bg-wds-neutral-100',
              action.emphasized ? 'px-wds-3 font-medium text-wds-text-ink' : 'px-wds-2.5 text-wds-text-copy-muted hover:text-wds-text-ink'
            )}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
