import * as React from 'react';

/**
 * Printable Purchase List — `XN8-0`. New composite, 04-components.md's
 * Milestone Two "New Purchase redesign" entry. Deliberately a distinct
 * print-only layout, not a styled version of the app screen: no sidebar,
 * topbar, or interactive controls — a US-Letter-proportioned document with
 * a checkbox column for physical tick-off and an explicit "estimate only"
 * disclaimer, per the brief's requirement #5.
 */

export interface PrintablePurchaseLine {
  itemName: string;
  quantity: number;
  buyUnit: string;
  estCost: number;
}

export interface PrintablePurchaseListProps {
  orgName: string;
  dateLabel: string;
  supplierLabel: string;
  requestedByName: string;
  lines: PrintablePurchaseLine[];
  estTotal: number;
}

export function PrintablePurchaseList({
  orgName,
  dateLabel,
  supplierLabel,
  requestedByName,
  lines,
  estTotal,
}: PrintablePurchaseListProps) {
  return (
    <div className="mx-auto flex w-[816px] flex-col bg-white py-12 px-14 font-wds-sans text-wds-text-ink print:w-full print:px-0 print:py-0">
      <div className="flex flex-col gap-[18px] border-b-2 border-wds-text-ink pb-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="font-wds-sans text-[20px] leading-6 font-semibold text-wds-text-ink">{orgName}</span>
            <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">Central Store — Purchase list</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-wds-mono text-[10px] leading-3 text-wds-text-copy-muted">{dateLabel}</span>
            <span className="font-wds-mono text-[10px] leading-3 text-wds-text-faint">Not a purchase order</span>
          </div>
        </div>
        <div className="flex items-center gap-7">
          <div className="flex flex-col gap-0.5">
            <span className="font-wds-mono text-[10px] uppercase tracking-wide leading-3 text-wds-text-faint">Supplier</span>
            <span className="font-wds-sans text-wds-body-sm text-wds-text-ink">{supplierLabel}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-wds-mono text-[10px] uppercase tracking-wide leading-3 text-wds-text-faint">
              Requested by
            </span>
            <span className="font-wds-sans text-wds-body-sm text-wds-text-ink">{requestedByName}</span>
          </div>
        </div>
      </div>

      <div className="mt-7 flex flex-col">
        <div className="flex h-7 shrink-0 items-center gap-5 border-b-[1.5px] border-wds-text-ink">
          <span className="w-6 shrink-0" />
          <span className="grow font-wds-mono text-wds-table-label uppercase text-wds-text-ink">Item</span>
          <span className="w-[120px] shrink-0 text-right font-wds-mono text-wds-table-label uppercase text-wds-text-ink">
            Quantity
          </span>
          <span className="w-[110px] shrink-0 text-right font-wds-mono text-wds-table-label uppercase text-wds-text-ink">
            Unit
          </span>
          <span className="w-[130px] shrink-0 text-right font-wds-mono text-wds-table-label uppercase text-wds-text-ink">
            Est. cost
          </span>
        </div>
        {lines.map((line) => (
          <div key={line.itemName} className="flex h-10 shrink-0 items-center gap-5 border-b border-wds-border">
            <span className="size-4 shrink-0 border-[1.5px] border-wds-text-ink" aria-hidden />
            <span className="grow font-wds-sans text-wds-body text-wds-text-ink">{line.itemName}</span>
            <span className="w-[120px] shrink-0 text-right font-wds-mono text-wds-body font-semibold text-wds-text-ink">
              {line.quantity}
            </span>
            <span className="w-[110px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-copy-muted">
              {line.buyUnit}
            </span>
            <span className="w-[130px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-copy-muted">
              KES {line.estCost.toLocaleString()}
            </span>
          </div>
        ))}
        <div className="mt-1 flex flex-col items-end gap-1 border-t-[1.5px] border-wds-text-ink pt-3.5">
          <div className="flex items-baseline gap-4">
            <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Est. total</span>
            <span className="font-wds-mono text-[16px] leading-5 font-semibold text-wds-text-ink">
              KES {estTotal.toLocaleString()}
            </span>
          </div>
          <span className="font-wds-sans text-wds-field-label text-wds-text-faint">
            Estimate only — confirm prices at time of purchase.
          </span>
        </div>
      </div>

      <div className="mt-12 flex flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-faint">Notes</span>
          <div className="h-px grow bg-wds-border" />
        </div>
        <div className="flex items-center justify-between gap-10">
          <div className="flex grow flex-col gap-2">
            <div className="h-px shrink-0 bg-wds-text-ink" />
            <span className="font-wds-mono text-[10px] uppercase tracking-wide leading-3 text-wds-text-faint">
              Purchased by / date
            </span>
          </div>
          <div className="flex grow flex-col gap-2">
            <div className="h-px shrink-0 bg-wds-text-ink" />
            <span className="font-wds-mono text-[10px] uppercase tracking-wide leading-3 text-wds-text-faint">
              Actual amount paid
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
