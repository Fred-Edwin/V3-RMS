'use client';

import * as React from 'react';
import { Minus, Plus, Printer, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Combobox, type ComboboxOption } from '@/components/ui2/combobox';
import type { SupplierPaymentTerms } from '../types';

/**
 * Purchase Selection Panel — desktop panel (`X9J-0` → `XEW-0`) and mobile
 * expanded review tray (`XXR-0`). New composite, 04-components.md's
 * Milestone Two "New Purchase redesign" entry.
 *
 * Line-total layout is a hard requirement from the brief: name + unit price
 * stacked on the left, stepper directly ABOVE the resulting line total on
 * the right — confirmed against `XEW-0`'s `get_jsx` (the stepper row sits
 * above the `KES 1,540` + `×` row, not interleaved). Do not revert to
 * interleaving name/total and price/stepper across two rows.
 */

export interface SelectedPurchaseLine {
  inventoryItemId: string;
  itemName: string;
  buyUnit: string;
  unitPrice: string;
  quantity: number;
}

export interface PurchaseSelectionPanelProps {
  lines: SelectedPurchaseLine[];
  onQuantityChange: (inventoryItemId: string, quantity: number) => void;
  onRemove: (inventoryItemId: string) => void;
  supplierOptions: ComboboxOption[];
  supplierLabel: string;
  onSupplierChange: (value: string) => void;
  onCreateSupplier?: (name: string) => void;
  paymentTerms: SupplierPaymentTerms;
  onPaymentTermsChange: (value: SupplierPaymentTerms) => void;
  hasSupplier: boolean;
  estTotal: number;
  onSave: () => void;
  onPrint: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  className?: string;
}

function lineTotal(line: SelectedPurchaseLine): number {
  return line.quantity * (Number(line.unitPrice) || 0);
}

/**
 * Private to this file — only one consumer exists; promote to ui2/ if a second one appears.
 * The center cell is a typeable number input, not a static label — +/- alone
 * can't reach a large quantity (e.g. 500) in a reasonable number of clicks.
 */
function Stepper({
  value,
  onChange,
  size = 'sm',
}: {
  value: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'lg';
}) {
  const sm = size === 'sm';
  const [text, setText] = React.useState(String(value));

  React.useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Math.floor(Number(text));
    if (Number.isFinite(parsed) && parsed >= 1) {
      onChange(parsed);
    } else {
      setText(String(value));
    }
  };

  return (
    <div
      className={cn(
        'flex shrink-0 items-center rounded-wds-sm border border-wds-border-strong',
        sm ? 'h-[26px]' : 'h-7'
      )}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className={cn(
          'flex h-full shrink-0 items-center justify-center font-wds-sans text-wds-body-sm text-wds-text-copy-muted outline-none transition-colors hover:text-wds-text-ink focus-visible:relative focus-visible:z-10 focus-visible:shadow-wds-ring',
          sm ? 'w-[22px]' : 'w-[26px]'
        )}
        aria-label="Decrease quantity"
      >
        <Minus className="size-3" strokeWidth={2} />
      </button>
      <input
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            e.currentTarget.blur();
          }
        }}
        inputMode="numeric"
        className={cn(
          'h-full shrink-0 border-x border-wds-border-strong bg-transparent text-center font-wds-mono text-wds-caption text-wds-text-ink outline-none',
          sm ? 'w-[30px]' : 'w-8'
        )}
        aria-label="Quantity"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className={cn(
          'flex h-full shrink-0 items-center justify-center font-wds-sans text-wds-body-sm text-wds-text-ink outline-none transition-colors hover:opacity-70 focus-visible:relative focus-visible:z-10 focus-visible:shadow-wds-ring',
          sm ? 'w-[22px]' : 'w-[26px]'
        )}
        aria-label="Increase quantity"
      >
        <Plus className="size-3" strokeWidth={2} />
      </button>
    </div>
  );
}

function SelectedLineRow({
  line,
  onQuantityChange,
  onRemove,
}: {
  line: SelectedPurchaseLine;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-wds-3 border-b border-wds-neutral-100 py-3 px-3.5 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{line.itemName}</span>
        <span className="font-wds-mono text-wds-label text-wds-text-faint">
          KES {Number(line.unitPrice).toLocaleString()}/{line.buyUnit}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-[5px]">
        <Stepper value={line.quantity} onChange={onQuantityChange} />
        <div className="flex items-center gap-wds-2">
          <span className="font-wds-mono text-wds-body-sm font-medium text-wds-text-ink">
            KES {lineTotal(line).toLocaleString()}
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="flex size-4 shrink-0 items-center justify-center text-wds-text-faint outline-none transition-colors hover:text-wds-error-fg focus-visible:shadow-wds-ring"
            aria-label={`Remove ${line.itemName}`}
          >
            <X className="size-3" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

const PAYMENT_TERMS_OPTIONS: { value: SupplierPaymentTerms; label: string }[] = [
  { value: 'INVOICE_TO_FOLLOW', label: 'Invoice' },
  { value: 'PAY_NOW', label: 'Paid on delivery' },
];

function PaymentTermsField({
  value,
  onChange,
  disabled,
}: {
  value: SupplierPaymentTerms;
  onChange: (value: SupplierPaymentTerms) => void;
  disabled: boolean;
}) {
  return (
    <div className={cn('flex flex-col gap-wds-1.5', disabled && 'pointer-events-none opacity-45')}>
      <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Payment terms</span>
      <div className="flex w-fit overflow-hidden rounded-wds-sm border border-wds-border-strong">
        {PAYMENT_TERMS_OPTIONS.map((opt, i) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            disabled={disabled}
            className={cn(
              'flex h-7 items-center px-wds-3 font-wds-sans text-wds-caption outline-none transition-colors',
              value === opt.value ? 'bg-wds-neutral-100 text-wds-text-ink' : 'text-wds-text-faint',
              i > 0 && 'border-l border-wds-border-strong'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {disabled ? (
        <span className="font-wds-sans text-wds-label text-wds-text-faint">Select a supplier to set payment terms.</span>
      ) : null}
    </div>
  );
}

function PanelBody({
  lines,
  onQuantityChange,
  onRemove,
  supplierOptions,
  supplierLabel,
  onSupplierChange,
  onCreateSupplier,
  paymentTerms,
  onPaymentTermsChange,
  hasSupplier,
}: Pick<
  PurchaseSelectionPanelProps,
  | 'lines'
  | 'onQuantityChange'
  | 'onRemove'
  | 'supplierOptions'
  | 'supplierLabel'
  | 'onSupplierChange'
  | 'onCreateSupplier'
  | 'paymentTerms'
  | 'onPaymentTermsChange'
  | 'hasSupplier'
>) {
  return (
    <>
      <div className="flex flex-col">
        {lines.map((line) => (
          <SelectedLineRow
            key={line.inventoryItemId}
            line={line}
            onQuantityChange={(q) => onQuantityChange(line.inventoryItemId, q)}
            onRemove={() => onRemove(line.inventoryItemId)}
          />
        ))}
      </div>
      <div className="flex flex-col gap-wds-3 border-t border-wds-border p-3.5">
        <div className="flex flex-col gap-wds-1.5">
          <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">
            Supplier &middot; optional
          </span>
          <Combobox
            value={supplierLabel}
            onValueChange={onSupplierChange}
            options={supplierOptions}
            placeholder="No supplier — save as shopping list"
            onCreate={onCreateSupplier}
          />
        </div>
        <PaymentTermsField value={paymentTerms} onChange={onPaymentTermsChange} disabled={!hasSupplier} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------ Desktop */

export function PurchaseSelectionPanelDesktop(props: PurchaseSelectionPanelProps) {
  const { lines, estTotal, onSave, onPrint, saving, saveDisabled, className } = props;
  return (
    <div className={cn('flex min-h-0 w-[340px] shrink-0 flex-col', className)}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-wds-border bg-wds-neutral-50 px-3.5">
          <span className="font-wds-sans text-wds-body font-semibold text-wds-text-ink">Selected items</span>
          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-wds-espresso-700 px-wds-1.5 font-wds-mono text-wds-label font-semibold text-white">
            {lines.length}
          </span>
        </div>
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 p-6 text-center">
            <span className="font-wds-sans text-wds-body-sm text-wds-text-faint">No items selected yet</span>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <PanelBody {...props} />
          </div>
        )}
        <div className="flex shrink-0 flex-col gap-3 border-t border-wds-border bg-wds-neutral-50 p-3.5">
          <div className="flex items-baseline justify-between">
            <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Est. total</span>
            <span className="font-wds-mono text-[16px] leading-5 text-wds-text-ink">
              ~KES {estTotal.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={onSave} disabled={saving || saveDisabled} className="h-[38px]">
              {saving ? 'Saving…' : 'Save purchase'}
            </Button>
            <Button variant="secondary" onClick={onPrint} className="h-9 gap-[7px]">
              <Printer className="size-3.5" strokeWidth={1.75} />
              Print list
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Mobile */

export function PurchaseSelectionPanelMobile(
  props: PurchaseSelectionPanelProps & { itemCount: number; onBack: () => void }
) {
  const { lines, estTotal, onSave, onPrint, saving, saveDisabled, itemCount, onBack, className } = props;
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col bg-wds-surface', className)}>
      <div className="flex shrink-0 flex-col gap-0.5 bg-wds-sidebar-mid px-5 pb-4 pt-2">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} aria-label="Back" className="flex shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" className="shrink-0">
              <path
                d="M19 12H5M12 19l-7-7 7-7"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <span className="pt-1.5 font-wds-sans text-[22px] leading-7 font-semibold text-white">Review purchase</span>
        <span className="font-wds-sans text-wds-body-sm text-white/60">
          {itemCount} items &middot; ~KES {estTotal.toLocaleString()}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="px-4 pb-2 pt-4">
          <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Items</span>
        </div>
        {lines.map((line) => (
          <div key={line.inventoryItemId} className="flex items-center justify-between gap-3 border-b border-wds-neutral-100 py-3 px-4">
            <div className="flex min-w-0 flex-col gap-[3px]">
              <span className="font-wds-sans text-wds-body text-wds-text-ink">{line.itemName}</span>
              <span className="font-wds-mono text-wds-caption text-wds-text-faint">
                KES {Number(line.unitPrice).toLocaleString()}/{line.buyUnit}
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Stepper size="lg" value={line.quantity} onChange={(q) => props.onQuantityChange(line.inventoryItemId, q)} />
              <span className="font-wds-mono text-wds-body-sm font-medium text-wds-text-ink">
                KES {lineTotal(line).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
        <div className="mt-2 flex flex-col gap-3.5 border-t border-wds-border py-5 px-4">
          <div className="flex flex-col gap-1.5">
            <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">
              Supplier &middot; optional
            </span>
            <Combobox
              value={props.supplierLabel}
              onValueChange={props.onSupplierChange}
              options={props.supplierOptions}
              placeholder="No supplier — save as shopping list"
              onCreate={props.onCreateSupplier}
            />
          </div>
          <PaymentTermsField value={props.paymentTerms} onChange={props.onPaymentTermsChange} disabled={!props.hasSupplier} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2.5 border-t border-wds-border bg-wds-surface py-3.5 px-4 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <div className="flex items-baseline justify-between">
          <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Est. total</span>
          <span className="font-wds-mono text-[16px] leading-5 text-wds-text-ink">
            ~KES {estTotal.toLocaleString()}
          </span>
        </div>
        <Button onClick={onSave} disabled={saving || saveDisabled} className="h-11 text-wds-section">
          {saving ? 'Saving…' : 'Save purchase'}
        </Button>
        <Button variant="secondary" onClick={onPrint} className="h-[42px] gap-2">
          <Printer className="size-3.5" strokeWidth={1.75} />
          Print list
        </Button>
      </div>
    </div>
  );
}
