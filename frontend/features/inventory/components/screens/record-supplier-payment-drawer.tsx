'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui2/toggle-group';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from '@/components/ui2/sheet';
import { formatApiErrorMessage } from '@/types/api';
import { BundleCheckboxList, BundleRunningTotal, type BundleRow } from '../bundle-checkbox-list';
import { getSupplierApDetail, createSupplierPayment } from '../../services/receiving-api-service';
import type { SupplierInvoice, SupplierPaymentMethod } from '../../types/receiving';

function formatPlainAmount(amount: string): string {
  const n = Number(amount);
  return Number.isFinite(n) ? n.toLocaleString() : amount;
}

function daysOverdue(dueDateIso: string): number {
  return Math.floor((Date.now() - new Date(dueDateIso).getTime()) / (1000 * 60 * 60 * 24));
}

const METHODS: { value: SupplierPaymentMethod; label: string }[] = [
  { value: 'BANK', label: 'Bank' },
  { value: 'CASH', label: 'Cash' },
  { value: 'MPESA', label: 'M-Pesa' },
];

/**
 * Record supplier payment — `V7Z-0` desktop drawer / `X4O-0` mobile
 * full-screen. Milestone Two S8. Invoice multi-select (reuses
 * `BundleCheckboxList`/`BundleRunningTotal`, plan §6.3 item 4) with
 * per-invoice age, live-recomputed "Allocated to selected." Overpayment
 * (amount exceeds the sum of allocations) is allowed by the backend — no
 * client-side block (plan §1.4, §7 Q5).
 */
export function RecordSupplierPaymentDrawer({
  supplierId,
  supplierName,
  open,
  onOpenChange,
  onRecorded,
  variant,
}: {
  supplierId: string;
  supplierName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded: () => void;
  variant: 'desktop' | 'mobile';
}) {
  const [invoices, setInvoices] = React.useState<SupplierInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [amount, setAmount] = React.useState('');
  const [paidAt, setPaidAt] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = React.useState<SupplierPaymentMethod>('BANK');
  const [reference, setReference] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setAmount('');
    setPaidAt(new Date().toISOString().slice(0, 10));
    setMethod('BANK');
    setReference('');
    setError(null);
    setLoadingInvoices(true);
    getSupplierApDetail(supplierId)
      .then((detail) => {
        const outstanding = detail.invoices.filter((inv) => Number(inv.outstanding) > 0);
        setInvoices(outstanding);
      })
      .catch((err) => setError(formatApiErrorMessage(err, 'Could not load outstanding invoices.')))
      .finally(() => setLoadingInvoices(false));
  }, [open, supplierId]);

  const selectedOutstanding = invoices
    .filter((inv) => selected.has(inv.id))
    .reduce((sum, inv) => sum + Number(inv.outstanding), 0);

  // Live-recompute "Allocated to selected" — default the amount field to the
  // selected total until the user types their own figure (overpayment case).
  const [amountTouched, setAmountTouched] = React.useState(false);
  React.useEffect(() => {
    if (!amountTouched) setAmount(selectedOutstanding > 0 ? String(selectedOutstanding) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutstanding]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rows: BundleRow[] = invoices.map((inv) => {
    const overdue = daysOverdue(inv.dueDate);
    return {
      id: inv.id,
      title: inv.invoiceNumber,
      subtitle: `${new Date(inv.invoiceDate).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })} · ${overdue > 0 ? `${overdue} days overdue` : `due in ${-overdue} days`}`,
      amountLabel: `KES ${formatPlainAmount(inv.outstanding)}`,
      checked: selected.has(inv.id),
    };
  });

  const amountNumber = Number(amount);
  const canSubmit = selected.size > 0 && Number.isFinite(amountNumber) && amountNumber > 0 && paidAt && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      // Overpayment allowed: allocations may sum to less than `amount` —
      // allocate the full outstanding to each selected invoice (never more
      // than what's owed, since the backend 400s on over-allocation).
      const allocations = invoices
        .filter((inv) => selected.has(inv.id))
        .map((inv) => ({ supplierInvoiceId: inv.id, amount: inv.outstanding }));
      await createSupplierPayment({
        supplierId,
        amount,
        paidAt: new Date(paidAt).toISOString(),
        method,
        reference: reference.trim() || undefined,
        allocations,
      });
      onRecorded();
      onOpenChange(false);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not record this payment.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={variant === 'mobile' ? 'w-full sm:max-w-full' : undefined}>
        <SheetHeader>
          <SheetTitle>Record supplier payment</SheetTitle>
          <SheetDescription>{supplierName}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-wds-4.5 overflow-y-auto px-wds-6 py-wds-5">
          {loadingInvoices ? (
            <p className="font-wds-sans text-wds-caption text-wds-text-copy-muted">Loading outstanding invoices…</p>
          ) : invoices.length === 0 ? (
            <p className="font-wds-sans text-wds-caption text-wds-text-copy-muted">No outstanding invoices for this supplier.</p>
          ) : (
            <>
              <BundleCheckboxList title="OUTSTANDING INVOICES" rows={rows} onToggle={toggle} />
              <BundleRunningTotal label="Allocated to selected" amountLabel={`KES ${selectedOutstanding.toLocaleString()}`} />
            </>
          )}

          <div className="flex gap-wds-3">
            <div className="flex grow flex-col gap-wds-1.5">
              <label htmlFor="payment-amount" className="font-wds-mono text-wds-label text-wds-text-copy-muted">AMOUNT</label>
              <input
                id="payment-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => {
                  setAmountTouched(true);
                  setAmount(e.target.value);
                }}
                className="h-8 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2.5 font-wds-mono text-wds-body-sm text-wds-text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wds-primary"
              />
            </div>
            <div className="flex grow flex-col gap-wds-1.5">
              <label htmlFor="payment-date" className="font-wds-mono text-wds-label text-wds-text-copy-muted">DATE</label>
              <input
                id="payment-date"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="h-8 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2.5 font-wds-mono text-wds-body-sm text-wds-text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wds-primary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-wds-1.5">
            <span className="font-wds-mono text-wds-label text-wds-text-copy-muted">METHOD</span>
            <ToggleGroup type="single" value={method} onValueChange={(v) => v && setMethod(v as SupplierPaymentMethod)} className="w-fit">
              {METHODS.map((m) => (
                <ToggleGroupItem key={m.value} value={m.value} className="h-8 px-wds-3.5 font-wds-sans text-wds-body-sm">
                  {m.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="flex flex-col gap-wds-1.5">
            <label htmlFor="payment-reference" className="font-wds-mono text-wds-label text-wds-text-copy-muted">REFERENCE</label>
            <input
              id="payment-reference"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="EFT-88213"
              className="h-8 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2.5 font-wds-mono text-wds-body-sm text-wds-text-ink placeholder:text-wds-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wds-primary"
            />
          </div>

          {error ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{error}</p> : null}
        </div>
        <SheetFooter className="flex-col items-stretch gap-wds-3">
          <div className="flex items-baseline justify-between">
            <span className="font-wds-mono text-wds-label text-wds-text-copy-muted">TOTAL PAYMENT</span>
            <span className="font-wds-mono text-[18px] text-wds-text-copy-muted">
              KES {Number.isFinite(amountNumber) ? amountNumber.toLocaleString() : '0'}
            </span>
          </div>
          <div className="flex items-center justify-end gap-wds-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? 'Recording…' : 'Record payment'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
