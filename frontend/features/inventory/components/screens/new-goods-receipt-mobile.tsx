'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Combobox } from '@/components/ui2/combobox';
import { SignSheetDialog } from '../sign-sheet';
import type { ReceiptLineRow } from '../receipt-line-grid';
import type { ClassifiedSignError } from '../../hooks/use-goods-receipt-form';
import type { InventoryItem, Supplier, SupplierPaymentTerms } from '../../types';

/**
 * New Goods Receipt — mobile (`4m · New Goods Receipt · mobile`, Paper page
 * C-0, owner-approved). No mobile artboard existed for this screen at S6
 * time; drawn as a follow-up once the owner flagged Attendant mobile
 * receiving as a real gap, not something covered by the worklist alone.
 *
 * Full-screen task pattern (dark header + back arrow, scrollable content,
 * sticky footer) — the same family as the New Purchase mobile screens
 * (`XUT-0`/`XXR-0`), not the Purchasing hub's persistent-shell pattern,
 * since this is a focused single task, not a hub landing.
 *
 * Steppers (–/qty/+) for quantity instead of a raw numeric keyboard input —
 * touch-first, matches `XXR-0`'s Review-purchase stepper exactly.
 */
export interface NewGoodsReceiptMobileProps {
  suppliers: Supplier[];
  supplierId: string;
  onSupplierChange: (id: string) => void;
  paymentTerms: SupplierPaymentTerms;
  onPaymentTermsChange: (terms: SupplierPaymentTerms) => void;
  supplierDocNumber: string;
  onSupplierDocNumberChange: (value: string) => void;
  rows: ReceiptLineRow[];
  onQtyChange: (id: string, value: string) => void;
  onUnitPriceChange: (id: string, value: string) => void;
  items: InventoryItem[];
  onAddItem: (item: InventoryItem) => void;
  alertedRows: ReceiptLineRow[];
  acknowledgedAlertIds: Set<string>;
  onToggleAcknowledged: (id: string) => void;
  receiptTotal: number;
  onSaveDraft: () => void;
  savingDraft: boolean;
  draftError: string | null;
  canSign: boolean;
  onSignAndSave: () => void;
  prefillNotice: boolean;
  signSheetOpen: boolean;
  onSignSheetOpenChange: (open: boolean) => void;
  supplierName: string;
  lineCount: number;
  onSignSubmit: (pin: string) => void;
  signing: boolean;
  signError: ClassifiedSignError | null;
  signedReceiptId: string | null;
  onViewSignedReceipt: () => void;
}

function Stepper({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const num = Number(value) || 0;
  return (
    <div className="flex h-8 shrink-0 items-center rounded-wds-md border border-wds-border-strong">
      <button
        type="button"
        onClick={() => onChange(String(Math.max(0, num - 1)))}
        className="flex h-full w-7 shrink-0 items-center justify-center font-wds-sans text-wds-body text-wds-text-copy-muted outline-none focus-visible:shadow-wds-ring"
      >
        &ndash;
      </button>
      <div className="flex h-full min-w-[44px] shrink-0 items-center justify-center border-x border-wds-border-strong px-wds-1">
        <span className="font-wds-mono text-wds-body-sm text-wds-text-ink">{value}</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(String(num + 1))}
        className="flex h-full w-7 shrink-0 items-center justify-center font-wds-sans text-wds-body text-wds-text-ink outline-none focus-visible:shadow-wds-ring"
      >
        +
      </button>
    </div>
  );
}

export function NewGoodsReceiptMobile({
  suppliers,
  supplierId,
  onSupplierChange,
  paymentTerms,
  onPaymentTermsChange,
  supplierDocNumber,
  onSupplierDocNumberChange,
  rows,
  onQtyChange,
  onUnitPriceChange,
  items,
  onAddItem,
  alertedRows,
  acknowledgedAlertIds,
  onToggleAcknowledged,
  receiptTotal,
  onSaveDraft,
  savingDraft,
  draftError,
  canSign,
  onSignAndSave,
  prefillNotice,
  signSheetOpen,
  onSignSheetOpenChange,
  supplierName,
  lineCount,
  onSignSubmit,
  signing,
  signError,
  signedReceiptId,
  onViewSignedReceipt,
}: NewGoodsReceiptMobileProps) {
  const router = useRouter();
  const [addingItem, setAddingItem] = React.useState(false);
  const supplierOptions = React.useMemo(() => suppliers.map((s) => ({ value: s.id, label: s.name })), [suppliers]);
  const supplierLabel = supplierOptions.find((o) => o.value === supplierId)?.label ?? '';
  const itemOptions = React.useMemo(() => items.map((i) => ({ value: i.id, label: i.name })), [items]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
      <div className="flex shrink-0 flex-col gap-0.5 bg-wds-sidebar-mid px-5 pb-4 pt-2">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => router.push('/app/inventory/receiving')} aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M19 12H5M12 19l-7-7 7-7" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" onClick={() => router.push('/app/inventory/receiving')} className="font-wds-sans text-wds-body text-white/75">
            Cancel
          </button>
        </div>
        <span className="pt-1.5 font-wds-sans text-[22px] leading-7 font-semibold text-white">New Goods Receipt</span>
        <span className="font-wds-sans text-wds-body-sm text-white/60">
          {supplierName || 'No supplier yet'}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {prefillNotice ? (
          <div className="flex items-start gap-wds-2 px-4 py-3 bg-wds-info-bg">
            <svg width="14" height="14" viewBox="0 0 24 24" className="mt-0.5 shrink-0">
              <path d="M9 11l3 3L22 4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-wds-info-fg" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-wds-info-fg" />
            </svg>
            <p className="font-wds-sans text-wds-body-sm text-wds-info-fg">
              Lines pre-filled from the linked delivery — adjust quantity and price to match what actually arrived.
            </p>
          </div>
        ) : null}

        {!supplierId ? (
          <div className="flex flex-col gap-wds-1.5 px-4 pt-4">
            <label className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Supplier</label>
            <Combobox
              value={supplierLabel}
              onValueChange={onSupplierChange}
              options={supplierOptions}
              placeholder="Select a supplier"
            />
          </div>
        ) : null}

        <div className="flex items-center gap-wds-2 px-4 pb-2 pt-4">
          <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">Items</span>
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-wds-full bg-wds-neutral-100 px-1.25">
            <span className="font-wds-mono text-wds-label text-wds-text-copy-muted">{rows.length}</span>
          </span>
        </div>

        {rows.map((row) => {
          const isAcknowledged = acknowledgedAlertIds.has(row.id);
          return (
            <div key={row.id} className="flex flex-col gap-wds-2.5 border-b border-wds-neutral-100 px-4 py-3">
              <div className="flex items-start justify-between gap-wds-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-wds-sans text-wds-body font-medium text-wds-text-ink">{row.itemName}</span>
                  <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-faint">{row.unitConversionLabel}</span>
                </div>
                {row.qtyDiscrepancyLabel ? (
                  <div className="flex shrink-0 items-center gap-wds-1 pt-0.5">
                    <span className="size-[5px] shrink-0 rounded-wds-full bg-wds-error-fg" />
                    <span className="whitespace-nowrap font-wds-sans text-[11px] text-wds-error-fg">{row.qtyDiscrepancyLabel}</span>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-wds-2">
                <Stepper value={row.qty} onChange={(v) => onQtyChange(row.id, v)} />
                <div className="flex shrink-0 items-center gap-wds-1.5">
                  <span className="font-wds-mono text-[11px] text-wds-text-faint">KES</span>
                  <div
                    className={`flex h-8 min-w-[64px] items-center justify-end rounded-wds-md border px-wds-2.5 ${
                      row.priceAlertLabel ? 'border-wds-warning-fg' : 'border-wds-border-strong'
                    }`}
                  >
                    <input
                      value={row.unitPrice}
                      onChange={(e) => onUnitPriceChange(row.id, e.target.value)}
                      inputMode="decimal"
                      className="w-full bg-transparent text-right font-wds-mono text-wds-body-sm text-wds-text-ink focus-visible:outline-none"
                    />
                  </div>
                </div>
              </div>
              {row.priceAlertLabel ? (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-wds-1.5">
                    <input type="checkbox" checked={isAcknowledged} onChange={() => onToggleAcknowledged(row.id)} />
                    <span className="font-wds-sans text-[12px] text-wds-warning-fg">Confirm this price</span>
                  </label>
                  <span className="font-wds-mono text-wds-body-sm font-medium text-wds-text-ink">KES {row.subtotal}</span>
                </div>
              ) : (
                <div className="flex justify-end">
                  <span className="font-wds-mono text-wds-body-sm font-medium text-wds-text-ink">KES {row.subtotal}</span>
                </div>
              )}
            </div>
          );
        })}

        {addingItem ? (
          <div className="flex items-center gap-wds-2 px-4 py-3">
            <Combobox
              value=""
              onValueChange={(value) => {
                const item = items.find((i) => i.id === value);
                if (item) onAddItem(item);
                setAddingItem(false);
              }}
              options={itemOptions}
              placeholder="Search items to add…"
              className="h-9"
            />
            <button type="button" onClick={() => setAddingItem(false)} className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingItem(true)}
            className="flex items-center justify-center px-4 py-3.5 text-center font-wds-sans text-wds-body-sm text-wds-caramel-600"
          >
            + Add item not on the delivery
          </button>
        )}

        <div className="flex flex-col gap-3.5 border-t border-wds-border px-4 py-4.5">
          <div className="flex flex-col gap-1.5">
            <span className="font-wds-mono uppercase tracking-wds-label text-wds-field-label text-wds-text-copy-muted">Payment terms</span>
            <div className="flex w-fit overflow-hidden rounded-wds-md border border-wds-border-strong">
              {(['INVOICE_TO_FOLLOW', 'PAY_NOW'] as const).map((terms) => (
                <button
                  key={terms}
                  type="button"
                  onClick={() => onPaymentTermsChange(terms)}
                  className={`flex h-[34px] items-center px-wds-3.5 font-wds-sans text-wds-body-sm transition-colors ${
                    paymentTerms === terms ? 'bg-wds-neutral-950 text-white' : 'text-wds-text-copy-muted'
                  }`}
                >
                  {terms === 'INVOICE_TO_FOLLOW' ? 'Invoice' : 'Paid on delivery'}
                </button>
              ))}
            </div>
            <span className="font-wds-sans text-[11px] leading-[15px] text-wds-text-faint">
              Defaulted from the supplier — you can change it for this receipt.
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-wds-mono uppercase tracking-wds-label text-wds-field-label text-wds-text-copy-muted">
              Invoice / delivery note number
            </span>
            <input
              value={supplierDocNumber}
              onChange={(e) => onSupplierDocNumberChange(e.target.value)}
              placeholder="Optional — can be added later"
              className="flex h-11 items-center rounded-wds-md border border-wds-border-strong px-wds-3 font-wds-sans text-wds-body text-wds-text-ink focus-visible:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2.5 border-t border-wds-border bg-wds-surface px-4 py-3.5 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <p className="font-wds-sans text-[11px] leading-[15px] text-wds-text-copy-muted">
          On sign: stock rises at the Central Store · status becomes Received — invoice pending · Store Manager notified.
        </p>
        {draftError ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{draftError}</p> : null}
        <div className="flex items-baseline justify-between">
          <span className="font-wds-mono uppercase tracking-wds-label text-wds-field-label text-wds-text-copy-muted">Total</span>
          <span className="font-wds-mono text-[16px] text-wds-text-ink">KES {receiptTotal.toLocaleString()}</span>
        </div>
        <button
          type="button"
          onClick={onSignAndSave}
          disabled={!canSign || savingDraft || signing}
          className="flex h-11 items-center justify-center rounded-wds-sm bg-wds-gradient-primary font-wds-sans font-medium text-white disabled:opacity-60"
        >
          Sign & save
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={!supplierId || rows.length === 0 || savingDraft}
          className="flex h-[42px] items-center justify-center rounded-wds-md border border-wds-border-strong font-wds-sans font-medium text-wds-text-ink disabled:opacity-60"
        >
          {savingDraft ? 'Saving…' : 'Save draft'}
        </button>
      </div>

      <SignSheetDialog
        open={signSheetOpen}
        onOpenChange={onSignSheetOpenChange}
        title="Sign & save"
        subtitle="Confirm this receipt with your PIN."
        helperText="Signing writes stock to the Central Store ledger and cannot be undone."
        documentSummary={{ title: supplierName, detail: `${lineCount} lines · KES ${receiptTotal.toLocaleString()}` }}
        confirmLabel={signError?.kind === 'already-signed-or-empty' ? 'View receipt' : 'Sign & save'}
        onSubmit={(pin) => {
          if (signError?.kind === 'already-signed-or-empty' && signedReceiptId) {
            onViewSignedReceipt();
            return;
          }
          onSignSubmit(pin);
        }}
        submitting={signing}
        error={signError?.message}
      />
    </div>
  );
}
