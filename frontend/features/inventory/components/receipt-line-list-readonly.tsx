import * as React from 'react';

import { cn } from '@/lib/cn';
import type { GoodsReceiptLine } from '../types/receiving';

/**
 * Read-only line display for the signed Goods Receipt detail (`UVN-0`) — a
 * dedicated component, not `ReceiptLineGrid` reused with a mode flag.
 * `ReceiptLineGrid` is Milestone Two's documented canonical composite
 * (04-components.md); this view renders a materially different, immutable
 * shape — the backend's persisted `priceAlert` audit object, rendered
 * verbatim, never recomputed against the item's current cost (which has
 * already moved on by the time this is read back).
 *
 * Column skeleton matches `ReceiptLineGrid` (grow item-name column with
 * truncate + tooltip, fixed-width numeric columns) so the two screens read
 * as one family; verified against longer item names and longer receipts
 * than Paper's mock via a scrollable body + sticky header.
 */
export interface ReceiptLineListReadonlyProps {
  lines: GoodsReceiptLine[];
  className?: string;
}

function formatPriceAlert(alert: GoodsReceiptLine['priceAlert']): string | null {
  if (!alert) return null;
  const pct = Number(alert.percentAboveLast);
  const pctLabel = Number.isFinite(pct) ? `${pct}%` : alert.percentAboveLast;
  const base = `${pctLabel} above last price (KES ${alert.previousPrice}).`;
  return alert.acceptedByName ? `${base} Accepted by ${alert.acceptedByName}.` : base;
}

export function ReceiptLineListReadonly({ lines, className }: ReceiptLineListReadonlyProps) {
  return (
    <div className={cn('flex w-full flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface', className)}>
      <div className="flex h-[30px] shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-4">
        <span className="grow font-wds-mono text-wds-table-label text-wds-text-ink">Item</span>
        <span className="w-[110px] shrink-0 text-right font-wds-mono text-wds-table-label text-wds-text-ink">Qty</span>
        <span className="w-[120px] shrink-0 text-right font-wds-mono text-wds-table-label text-wds-text-ink">Unit price</span>
        <span className="w-[110px] shrink-0 text-right font-wds-mono text-wds-table-label text-wds-text-ink">Subtotal</span>
      </div>

      <div className="flex max-h-[420px] flex-col overflow-y-auto">
        {lines.map((line) => {
          const alertText = formatPriceAlert(line.priceAlert);
          return (
            <div key={line.id} className="flex min-h-[46px] shrink-0 flex-col justify-center gap-wds-1 border-b border-wds-neutral-100 px-wds-4 py-wds-2 last:border-b-0">
              <div className="flex items-center">
                <div className="grow min-w-0">
                  <span
                    className="block truncate font-wds-sans text-wds-body-sm font-medium text-wds-text-ink"
                    title={line.itemName}
                  >
                    {line.itemName}
                  </span>
                </div>
                <span className="w-[110px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-ink">
                  {line.quantityBuyUnit} {line.buyUnit}
                </span>
                <span className="w-[120px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-ink">
                  {line.unitPrice}
                </span>
                <span className="w-[110px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-ink">
                  {line.lineTotal}
                </span>
              </div>
              {alertText ? (
                <div className="flex items-center gap-wds-1 pr-[340px]">
                  <span className="size-[5px] shrink-0 rounded-wds-full bg-wds-warning-fg" aria-hidden />
                  <span className="font-wds-sans text-wds-field-label text-wds-warning-fg">{alertText}</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
