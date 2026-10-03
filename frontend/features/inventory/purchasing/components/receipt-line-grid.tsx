import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Receipt Line Grid — New Goods Receipt (UQE-0). Genuinely new this
 * milestone (04-components.md Milestone Two #3), not an extension of
 * `restock-level-grid.tsx` — that composite is a single-editable-number-
 * per-row shape; this one needs qty + buy-unit chip + unit price +
 * computed subtotal + an inline price-alert badge per row, confirmed a
 * materially different shape per the S0 brief. `restock-level-grid.tsx` is
 * used only as the row-layout/tone-convention pattern reference (desktop-
 * only here — Paper draws no mobile counterpart for this screen in this
 * milestone).
 *
 * Reference: `UQE-0` ("4 · New Goods Receipt · desktop"), the grid node
 * `UQV-0`. Every value below sourced via `get_jsx`/`get_computed_styles`
 * on that node, not eyeballed from the screenshot.
 */
export interface ReceiptLineRow {
  id: string;
  itemName: string;
  /** e.g. "buy: crate (12) → usage: kg" */
  unitConversionLabel: string;
  qty: string;
  buyUnit: string;
  unitPrice: string;
  subtotal: string;
  /** e.g. "38% above last" — omit when no price alert fired on this line. */
  priceAlertLabel?: string;
  /**
   * e.g. "Short 2 crate vs. expected" — the received qty differs from what
   * an expected delivery estimated. Independent of `priceAlertLabel` (a
   * line can be short AND priced above last, both badges render together).
   */
  qtyDiscrepancyLabel?: string;
}

export interface ReceiptLineGridProps {
  rows: ReceiptLineRow[];
  onQtyChange: (id: string, value: string) => void;
  onUnitPriceChange: (id: string, value: string) => void;
  onAddLine?: () => void;
  /**
   * Renders in place of the default "+ Add line" trailing button — for the
   * inline "add item not on the delivery" row (a combobox that appears in
   * this exact footer slot, not a dialog). Takes precedence over `onAddLine`
   * when both are given.
   */
  addLineSlot?: React.ReactNode;
  className?: string;
}

export function ReceiptLineGrid({
  rows,
  onQtyChange,
  onUnitPriceChange,
  onAddLine,
  addLineSlot,
  className,
}: ReceiptLineGridProps) {
  return (
    <div className={cn('flex w-full flex-col rounded-wds-md border border-wds-border bg-wds-surface', className)}>
      <div className="flex h-[30px] shrink-0 items-center overflow-hidden rounded-t-wds-md border-b border-wds-text-ink bg-wds-table-header-bg px-wds-4">
        <span className="grow font-wds-mono text-wds-table-label text-wds-text-ink">
          Item
        </span>
        <span className="w-[150px] shrink-0 text-right font-wds-mono text-wds-table-label text-wds-text-ink">
          Qty
        </span>
        <span className="w-[120px] shrink-0 text-right font-wds-mono text-wds-table-label text-wds-text-ink">
          Unit price
        </span>
        <span className="w-[110px] shrink-0 text-right font-wds-mono text-wds-table-label text-wds-text-ink">
          Subtotal
        </span>
        <span className="w-8 shrink-0" />
      </div>

      {/* Scrollable row body — the header above and the add-line footer below
          stay outside this container so a long receipt scrolls internally
          instead of growing the whole page, and so the add-line combobox's
          floating dropdown (also outside this container) is never clipped
          by an ancestor's overflow. */}
      <div className="flex max-h-[420px] flex-col overflow-y-auto">
        {rows.map((row) => (
          <div key={row.id} className="flex h-[46px] shrink-0 items-center border-b border-wds-neutral-100 px-wds-4 last:border-b-0">
            <div className="flex grow flex-col gap-px">
              <div className="flex items-center gap-wds-1.5">
                <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{row.itemName}</span>
                {row.qtyDiscrepancyLabel ? (
                  <span className="flex items-center gap-wds-1">
                    <span className="size-[5px] shrink-0 rounded-wds-full bg-wds-error-fg" aria-hidden />
                    <span className="font-wds-sans text-wds-field-label text-wds-error-fg">{row.qtyDiscrepancyLabel}</span>
                  </span>
                ) : null}
                {row.priceAlertLabel ? (
                  <span className="flex items-center gap-wds-1">
                    <span className="size-[5px] shrink-0 rounded-wds-full bg-wds-warning-fg" aria-hidden />
                    <span className="font-wds-sans text-wds-field-label text-wds-warning-fg">{row.priceAlertLabel}</span>
                  </span>
                ) : null}
              </div>
              <span className="font-wds-mono text-[10px] leading-3 text-wds-text-faint">{row.unitConversionLabel}</span>
            </div>

            <div className="flex w-[150px] shrink-0 justify-end">
              <div className="flex h-7 w-full shrink-0 items-center overflow-hidden rounded-wds-sm border border-wds-border-strong bg-wds-surface">
                <input
                  value={row.qty}
                  onChange={(e) => onQtyChange(row.id, e.target.value)}
                  className="w-10 min-w-[36px] grow bg-transparent px-wds-2 text-right font-wds-mono text-wds-body-sm text-wds-text-ink focus-visible:outline-none"
                />
                <div
                  className="flex h-full shrink-0 items-center overflow-hidden border-l border-wds-border-strong bg-wds-neutral-50 px-wds-1.5"
                  title={row.buyUnit}
                >
                  <span className="truncate font-wds-mono text-wds-field-label text-wds-neutral-500">{row.buyUnit}</span>
                </div>
              </div>
            </div>

            <div className="flex w-[120px] shrink-0 justify-end">
              <div
                className={cn(
                  'flex h-7 w-24 shrink-0 items-center rounded-wds-sm border bg-wds-surface px-wds-2.5',
                  row.priceAlertLabel ? 'border-wds-warning-fg' : 'border-wds-border-strong'
                )}
              >
                <input
                  value={row.unitPrice}
                  onChange={(e) => onUnitPriceChange(row.id, e.target.value)}
                  className="w-full grow bg-transparent text-right font-wds-mono text-wds-body-sm text-wds-text-ink focus-visible:outline-none"
                />
              </div>
            </div>

            <span className="w-[110px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-ink">
              {row.subtotal}
            </span>
            <span className="w-8 shrink-0" />
          </div>
        ))}
      </div>

      {addLineSlot ?? (onAddLine ? (
        <button
          type="button"
          onClick={onAddLine}
          className="flex h-11 shrink-0 items-center rounded-b-wds-md px-wds-4 text-left font-wds-sans text-wds-body-sm text-wds-caramel-600"
        >
          + Add line
        </button>
      ) : null)}
    </div>
  );
}
