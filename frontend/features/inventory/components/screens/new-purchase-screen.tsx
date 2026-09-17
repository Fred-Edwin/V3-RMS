'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { DrawerShell } from '../drawer-shell';
import { MobileTaskHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui2/select';
import { useLastPrice, useNewPurchaseOptions, useSaveExpectedDelivery } from '../../hooks/use-new-purchase-form';
import type { InventoryItem, SupplierPaymentTerms } from '../../types';

interface DraftLine {
  id: string;
  inventoryItemId: string;
  quantity: string;
  estimatedUnitPrice: string;
}

const PAYMENT_TERMS_OPTIONS: { value: SupplierPaymentTerms; label: string }[] = [
  { value: 'INVOICE_TO_FOLLOW', label: 'Invoice' },
  { value: 'PAY_NOW', label: 'Paid on delivery' },
];

/**
 * Payment-terms toggle — the same "espresso-50 tint, primary text" selected
 * style as `supplier-form.tsx`'s `DesktopPaymentTermsToggle`, confirmed
 * against `UEP-0`'s own `get_jsx` (the selected "Invoice" segment is a flat
 * `--color-espresso-700` fill with white text here, a genuinely different
 * selected treatment from the Supplier form's tint — read independently,
 * not assumed to match).
 */
function PaymentTermsToggle({
  value,
  onChange,
}: {
  value: SupplierPaymentTerms;
  onChange: (value: SupplierPaymentTerms) => void;
}) {
  return (
    <div className="flex h-8 w-fit overflow-hidden rounded-wds-sm border border-wds-border-strong">
      {PAYMENT_TERMS_OPTIONS.map((opt, i) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex h-full items-center px-wds-3.5 font-wds-sans text-wds-body-sm outline-none transition-colors',
              selected ? 'bg-wds-espresso-700 text-white hover:bg-wds-espresso-600' : 'bg-wds-surface text-wds-text-copy-muted hover:bg-wds-neutral-50 hover:text-wds-text-ink',
              'focus-visible:relative focus-visible:z-10 focus-visible:shadow-wds-ring',
              i > 0 && 'border-l border-wds-border-strong'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function formatLastPurchase(lastPrice: { unitPrice: string; asOf: string } | null): string | null {
  if (!lastPrice) return null;
  const date = new Date(lastPrice.asOf).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `Last purchase ${date} · KES ${Number(lastPrice.unitPrice).toLocaleString()}`;
}

function estimateTotal(lines: DraftLine[]): number {
  return lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.estimatedUnitPrice) || 0), 0);
}

export interface NewPurchaseDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  variant: 'desktop' | 'mobile';
}

/**
 * New purchase — screen 2 (`UEP-0` drawer / `X1O-0` mobile full-screen).
 * "Not a purchase order — an estimate. Saves to the Inbound band." Supplier
 * picker + "Last purchase …" reference (from the first line's item, since
 * the endpoint is per-item, not per-supplier — plan §3.2), payment-terms
 * toggle, line entry, `POST /expected-deliveries` on save.
 */
export function NewPurchaseDrawer({ open, onOpenChange, onSaved, variant }: NewPurchaseDrawerProps) {
  const { suppliers, items } = useNewPurchaseOptions(open);
  const { save, saving, error } = useSaveExpectedDelivery();
  const [supplierId, setSupplierId] = React.useState<string>('');
  const [paymentTerms, setPaymentTerms] = React.useState<SupplierPaymentTerms>('INVOICE_TO_FOLLOW');
  const [lines, setLines] = React.useState<DraftLine[]>([{ id: crypto.randomUUID(), inventoryItemId: '', quantity: '', estimatedUnitPrice: '' }]);

  React.useEffect(() => {
    if (!open) {
      setSupplierId('');
      setPaymentTerms('INVOICE_TO_FOLLOW');
      setLines([{ id: crypto.randomUUID(), inventoryItemId: '', quantity: '', estimatedUnitPrice: '' }]);
    }
  }, [open]);

  const lastPrice = useLastPrice(lines[0]?.inventoryItemId || null);
  const lastPurchaseLabel = formatLastPurchase(lastPrice);

  const itemById = React.useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  const setLine = (id: string, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const addLine = () =>
    setLines((prev) => [...prev, { id: crypto.randomUUID(), inventoryItemId: '', quantity: '', estimatedUnitPrice: '' }]);

  const total = estimateTotal(lines);
  const validLines = lines.filter((l) => l.inventoryItemId && l.quantity);
  const canSave = Boolean(supplierId) && validLines.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    const result = await save({
      supplierId,
      paymentTerms,
      lines: validLines.map((l) => ({
        inventoryItemId: l.inventoryItemId,
        quantity: l.quantity,
        estimatedUnitPrice: l.estimatedUnitPrice || '0',
      })),
    });
    if (result) {
      onSaved();
      onOpenChange(false);
    }
  };

  if (!open) return null;

  const body = (
    <div className="flex flex-col gap-wds-4.5">
      <div className="flex flex-col gap-wds-1.5">
        <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Supplier</span>
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a supplier" />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {lastPurchaseLabel ? (
          <span className="font-wds-sans text-wds-field-label text-wds-text-faint">{lastPurchaseLabel}</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-wds-1.5">
        <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Payment terms</span>
        <PaymentTermsToggle value={paymentTerms} onChange={setPaymentTerms} />
      </div>

      <div className="flex flex-col overflow-hidden rounded-wds-md border border-wds-border">
        <div className="flex h-[30px] shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-3">
          <span className="grow font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Item</span>
          <span className="w-16 shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Qty</span>
          <span className="w-20 shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Est.</span>
        </div>
        {lines.map((line) => {
          const item = itemById.get(line.inventoryItemId);
          return (
            <div key={line.id} className="flex h-11 shrink-0 items-center gap-wds-2 border-b border-wds-neutral-100 px-wds-3">
              <div className="grow">
                <Select
                  value={line.inventoryItemId}
                  onValueChange={(v) => {
                    const selected = itemById.get(v);
                    // Seed the real default from the item's current cost, not just a
                    // placeholder — a placeholder alone implies a value that a user
                    // tabbing past the field without typing would never actually submit.
                    setLine(line.id, {
                      inventoryItemId: v,
                      estimatedUnitPrice: line.estimatedUnitPrice || selected?.currentCost || '',
                    });
                  }}
                >
                  <SelectTrigger className="h-7 border-none px-0 shadow-none">
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <input
                value={line.quantity}
                onChange={(e) => setLine(line.id, { quantity: e.target.value })}
                placeholder="0"
                className="w-16 shrink-0 rounded-wds-sm bg-transparent text-right font-wds-mono text-wds-caption text-wds-text-ink outline-none transition-colors focus-visible:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
              />
              <input
                value={line.estimatedUnitPrice}
                onChange={(e) => setLine(line.id, { estimatedUnitPrice: e.target.value })}
                placeholder={item?.currentCost ?? '0'}
                className="w-20 shrink-0 rounded-wds-sm bg-transparent text-right font-wds-mono text-wds-caption text-wds-text-copy-muted outline-none transition-colors focus-visible:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
              />
            </div>
          );
        })}
        <button
          type="button"
          onClick={addLine}
          className="flex h-9 shrink-0 items-center px-wds-3 text-left font-wds-sans text-wds-caption text-wds-caramel-600 outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
        >
          + Add line
        </button>
      </div>

      {error ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{error}</p> : null}
    </div>
  );

  if (variant === 'mobile') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-wds-canvas">
        <MobileStatusBar />
        <MobileTaskHeader
          title="New purchase"
          subtitle="Not a purchase order — an estimate. Saves to the Inbound band."
          trailingAction="Cancel"
          onBack={() => onOpenChange(false)}
          onTrailingAction={() => onOpenChange(false)}
        />
        <div className="flex-1 overflow-y-auto p-4">{body}</div>
        <div className="flex flex-col gap-wds-3 border-t border-wds-border p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Est. total</span>
            <span className="font-wds-mono text-[18px] leading-[22px] text-wds-text-copy-muted">
              ~KES {total.toLocaleString()}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !canSave}
            className="flex h-11 w-full items-center justify-center rounded-wds-md bg-wds-gradient-primary font-wds-sans text-wds-body font-medium text-wds-primary-fg outline-none transition-opacity hover:enabled:opacity-90 focus-visible:shadow-wds-ring active:enabled:opacity-80 disabled:opacity-60"
          >
            Save purchase
          </button>
        </div>
      </div>
    );
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="New purchase"
      description="Not a purchase order — an estimate. Saves to the Inbound band."
      primaryLabel="Save purchase"
      onPrimaryAction={handleSave}
      primaryDisabled={saving || !canSave}
    >
      {body}
      <div className="flex items-baseline justify-between border-t border-wds-border pt-wds-3">
        <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Est. total</span>
        <span className="font-wds-mono text-[18px] leading-[22px] text-wds-text-copy-muted">
          ~KES {total.toLocaleString()}
        </span>
      </div>
    </DrawerShell>
  );
}
