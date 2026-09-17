'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Combobox, type ComboboxOption } from '@/components/ui2/combobox';
import { MobileTaskHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { Topbar } from '@/components/app/shell/topbar';
import { ItemPickerCombobox } from '../item-picker-combobox';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  useCreateSupplierInline,
  useNewPurchaseOptions,
  useRecentSupplierItems,
  useSaveExpectedDelivery,
} from '../../hooks/use-new-purchase-form';
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
 * Payment-terms toggle — unchanged from the drawer version (`UEP-0`'s
 * `get_jsx`: selected "Invoice" segment is a flat `espresso-700` fill with
 * white text, a different selected treatment from Supplier Form's tint).
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

const emptyLine = (): DraftLine => ({ id: crypto.randomUUID(), inventoryItemId: '', quantity: '', estimatedUnitPrice: '' });

/**
 * New purchase — full-page purchase builder (2026-09-17 UI refinement).
 * Replaces the drawer (`UEP-0`/`X1O-0`) with a dedicated route on both
 * desktop and mobile: the drawer's cramped `<Select>` item picker made
 * scrolling a large catalog painful, and there was no room for the owner's
 * requested "recent items" section or inline supplier creation. Same
 * underlying save call (`POST /expected-deliveries`) and the same
 * "not a purchase order — an estimate" framing.
 */
export function NewPurchaseScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const router = useRouter();
  const { suppliers, items, addSupplier } = useNewPurchaseOptions(true);
  const { save, saving, error } = useSaveExpectedDelivery();
  const { create: createSupplierInline, saving: creatingSupplier, error: createSupplierError } = useCreateSupplierInline();

  const [supplierId, setSupplierId] = React.useState<string>('');
  const [paymentTerms, setPaymentTerms] = React.useState<SupplierPaymentTerms>('INVOICE_TO_FOLLOW');
  const [lines, setLines] = React.useState<DraftLine[]>([emptyLine()]);
  const [pendingSupplierName, setPendingSupplierName] = React.useState<string | null>(null);
  const [newSupplierPhone, setNewSupplierPhone] = React.useState('');
  const [newSupplierTerms, setNewSupplierTerms] = React.useState<SupplierPaymentTerms>('INVOICE_TO_FOLLOW');

  const { items: recentItems } = useRecentSupplierItems(supplierId || null);

  const supplierOptions: ComboboxOption[] = suppliers.map((s) => ({ value: s.id, label: s.name }));

  const firstLineItemId = lines[0]?.inventoryItemId;
  const firstLineRecent = firstLineItemId ? recentItems.find((r) => r.inventoryItemId === firstLineItemId) : undefined;
  const lastPurchaseLabel = formatLastPurchase(
    firstLineRecent ? { unitPrice: firstLineRecent.lastUnitPrice, asOf: firstLineRecent.lastPurchasedAt } : null
  );

  const itemById = React.useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  const setLine = (id: string, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (id: string) => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));

  const total = estimateTotal(lines);
  const validLines = lines.filter((l) => l.inventoryItemId && l.quantity);
  const canSave = Boolean(supplierId) && validLines.length > 0;

  const goBack = () => router.push('/app/inventory/purchasing');

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
    if (result) goBack();
  };

  const handleCreateSupplier = async () => {
    if (!pendingSupplierName) return;
    const created = await createSupplierInline({
      name: pendingSupplierName,
      phone: newSupplierPhone || null,
      defaultPaymentTerms: newSupplierTerms,
    });
    if (created) {
      addSupplier(created);
      setSupplierId(created.id);
      setPendingSupplierName(null);
      setNewSupplierPhone('');
      setNewSupplierTerms('INVOICE_TO_FOLLOW');
    }
  };

  if (!hydrated) return null;

  const body = (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-wds-5">
      <div className="flex flex-col gap-wds-1.5">
        <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Supplier</span>
        <Combobox
          value={supplierOptions.find((o) => o.value === supplierId)?.label ?? ''}
          onValueChange={(v) => {
            setSupplierId(v);
            setPendingSupplierName(null);
          }}
          options={supplierOptions}
          placeholder="Search or create a supplier"
          onCreate={(name) => setPendingSupplierName(name)}
        />
        {lastPurchaseLabel ? (
          <span className="font-wds-sans text-wds-field-label text-wds-text-faint">{lastPurchaseLabel}</span>
        ) : null}

        {pendingSupplierName ? (
          <div className="flex flex-col gap-wds-3 rounded-wds-md border border-wds-border bg-wds-surface-sunken p-wds-3.5">
            <div className="flex items-center justify-between">
              <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">
                New supplier — &quot;{pendingSupplierName}&quot;
              </span>
              <button
                type="button"
                onClick={() => setPendingSupplierName(null)}
                className="font-wds-sans text-wds-caption text-wds-text-copy-muted outline-none transition-colors hover:text-wds-text-ink focus-visible:shadow-wds-ring"
              >
                Cancel
              </button>
            </div>
            <div className="flex flex-col gap-wds-1.5">
              <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Phone</span>
              <input
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                placeholder="07…"
                className="flex h-8 w-full items-center rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-3 font-wds-sans text-wds-body-sm text-wds-text-ink outline-none transition-colors focus-visible:border-wds-primary focus-visible:shadow-wds-ring"
              />
            </div>
            <div className="flex flex-col gap-wds-1.5">
              <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Payment terms</span>
              <PaymentTermsToggle value={newSupplierTerms} onChange={setNewSupplierTerms} />
            </div>
            {createSupplierError ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{createSupplierError}</p> : null}
            <Button size="sm" onClick={handleCreateSupplier} disabled={creatingSupplier} className="self-start">
              {creatingSupplier ? 'Creating…' : `Create & select "${pendingSupplierName}"`}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-wds-1.5">
        <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Payment terms</span>
        <PaymentTermsToggle value={paymentTerms} onChange={setPaymentTerms} />
      </div>

      <div className="flex flex-col rounded-wds-md border border-wds-border">
        <div className="flex h-[30px] shrink-0 items-center rounded-t-wds-md border-b border-wds-text-ink bg-wds-table-header-bg px-wds-3">
          <span className="grow font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Item</span>
          <span className="w-20 shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Qty</span>
          <span className="w-24 shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Unit price</span>
          <span className="w-24 shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Total</span>
          <span className="w-9 shrink-0" />
        </div>
        {lines.map((line) => {
          const item = itemById.get(line.inventoryItemId);
          const lineTotal = (Number(line.quantity) || 0) * (Number(line.estimatedUnitPrice) || 0);
          return (
            <div key={line.id} className="flex h-11 shrink-0 items-center gap-wds-2 border-b border-wds-neutral-100 px-wds-3">
              <div className="min-w-0 grow">
                <ItemPickerCombobox
                  value={line.inventoryItemId}
                  onValueChange={(itemId) => {
                    const chosen = itemById.get(itemId);
                    // Prefer this supplier's own last price over the item's catalog-wide
                    // currentCost — a materially better default (and currentCost is often
                    // "0" for an item that's never been received yet, e.g. seed data).
                    const recentPrice = recentItems.find((r) => r.inventoryItemId === itemId)?.lastUnitPrice;
                    const seededPrice = recentPrice || chosen?.currentCost;
                    setLine(line.id, {
                      inventoryItemId: itemId,
                      estimatedUnitPrice: line.estimatedUnitPrice || (seededPrice && seededPrice !== '0' ? seededPrice : ''),
                    });
                  }}
                  items={items}
                  recentItems={recentItems}
                />
              </div>
              <input
                value={line.quantity}
                onChange={(e) => setLine(line.id, { quantity: e.target.value })}
                placeholder="0"
                className="w-20 shrink-0 rounded-wds-sm bg-transparent text-right font-wds-mono text-wds-caption text-wds-text-ink outline-none transition-colors focus-visible:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
              />
              <input
                value={line.estimatedUnitPrice}
                onChange={(e) => setLine(line.id, { estimatedUnitPrice: e.target.value })}
                placeholder={item?.currentCost ?? '0'}
                className="w-24 shrink-0 rounded-wds-sm bg-transparent text-right font-wds-mono text-wds-caption text-wds-text-copy-muted outline-none transition-colors focus-visible:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
              />
              <span className="w-24 shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-copy-muted">
                {lineTotal > 0 ? lineTotal.toLocaleString() : '—'}
              </span>
              <button
                type="button"
                onClick={() => removeLine(line.id)}
                disabled={lines.length === 1}
                title="Remove line"
                className="flex w-9 shrink-0 items-center justify-center font-wds-sans text-wds-caption text-wds-text-faint outline-none transition-colors hover:text-wds-error-fg focus-visible:shadow-wds-ring disabled:pointer-events-none disabled:opacity-40"
              >
                ×
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={addLine}
          className="flex h-9 shrink-0 items-center rounded-b-wds-md px-wds-3 text-left font-wds-sans text-wds-caption text-wds-caramel-600 outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
        >
          + Add line
        </button>
      </div>

      {error ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{error}</p> : null}
    </div>
  );

  if (!isDesktop) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <MobileStatusBar />
        <MobileTaskHeader
          title="New purchase"
          subtitle="Not a purchase order — an estimate. Saves to the Inbound band."
          trailingAction="Cancel"
          onBack={goBack}
          onTrailingAction={goBack}
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{body}</div>
        <div className="flex flex-col gap-wds-3 border-t border-wds-border p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Est. total</span>
            <span className="font-wds-mono text-[18px] leading-[22px] text-wds-text-copy-muted">~KES {total.toLocaleString()}</span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !canSave}
            className="flex h-11 w-full items-center justify-center rounded-wds-md bg-wds-gradient-primary font-wds-sans text-wds-body font-medium text-wds-primary-fg outline-none transition-opacity hover:enabled:opacity-90 focus-visible:shadow-wds-ring active:enabled:opacity-80 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save purchase'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: 'Central Store', screen: 'New purchase' }} className="shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-7">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-1 pb-wds-5">
          <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">New purchase</h1>
          <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            Not a purchase order — an estimate. Saves to the Inbound band.
          </p>
        </div>
        {body}
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-between border-t border-wds-border pt-wds-4">
          <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Est. total</span>
          <div className="flex items-center gap-wds-3">
            <span className="font-wds-mono text-[18px] leading-[22px] text-wds-text-copy-muted">~KES {total.toLocaleString()}</span>
            <Button variant="secondary" onClick={goBack}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving ? 'Saving…' : 'Save purchase'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
