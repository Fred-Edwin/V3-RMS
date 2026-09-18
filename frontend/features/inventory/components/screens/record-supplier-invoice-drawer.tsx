'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
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
import { DisputeCallout } from '../dispute-callout';
import { listGoodsReceipts, createSupplierInvoice } from '../../services/receiving-api-service';
import type { GoodsReceiptDetail } from '../../types/receiving';

function formatPlainAmount(amount: string): string {
  const n = Number(amount);
  return Number.isFinite(n) ? n.toLocaleString() : amount;
}

/**
 * Record supplier invoice — `UZJ-0` desktop drawer / `X2Y-0` mobile
 * full-screen. Milestone Two S8. Bundling checkbox list against
 * `RECEIVED_INVOICE_PENDING` receipts for this supplier, live-recomputed
 * "Our figure." Three actions, one write path (plan §3.2):
 * - Save invoice → `POST /supplier-invoices`, no `dispute`.
 * - Record at billed — open dispute → same endpoint, `dispute` set
 *   (shown only once the typed billed amount disagrees with "our figure").
 * - Hold → client-side only, closes the drawer, no request at all.
 */
export function RecordSupplierInvoiceDrawer({
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
  const [receipts, setReceipts] = React.useState<GoodsReceiptDetail[]>([]);
  const [loadingReceipts, setLoadingReceipts] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [invoiceNumber, setInvoiceNumber] = React.useState('');
  const [invoiceDate, setInvoiceDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [amountBilled, setAmountBilled] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setAmountBilled('');
    setAmountTouched(false);
    setError(null);
    setLoadingReceipts(true);
    listGoodsReceipts({ status: 'RECEIVED_INVOICE_PENDING', supplierId, limit: 100 })
      .then(setReceipts)
      .catch((err) => setError(formatApiErrorMessage(err, 'Could not load receipts to bundle.')))
      .finally(() => setLoadingReceipts(false));
  }, [open, supplierId]);

  const ourFigure = receipts
    .filter((r) => selected.has(r.id))
    .reduce((sum, r) => sum + Number(r.receiptTotal), 0);

  // Defaults AMOUNT BILLED to what we received once a receipt is selected —
  // the common case is the supplier bills exactly that, so this saves a
  // retype. Only touches the field while it still matches our own running
  // total: once the Store Manager edits it away from that (to match the real
  // invoice), their figure is never overwritten by a later selection change.
  const [amountTouched, setAmountTouched] = React.useState(false);
  React.useEffect(() => {
    if (!amountTouched) setAmountBilled(selected.size > 0 ? String(ourFigure) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ourFigure, selected.size]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rows: BundleRow[] = receipts.map((r) => ({
    id: r.id,
    title: r.reference,
    subtitle: `${r.lines.length} line${r.lines.length === 1 ? '' : 's'}`,
    amountLabel: `KES ${formatPlainAmount(r.receiptTotal)}`,
    checked: selected.has(r.id),
  }));

  const billedNumber = Number(amountBilled);
  const hasMismatch =
    selected.size > 0 &&
    amountBilled.trim() !== '' &&
    Number.isFinite(billedNumber) &&
    Math.abs(billedNumber - ourFigure) > 0.005;

  const baseCanSubmit =
    selected.size > 0 &&
    invoiceNumber.trim() !== '' &&
    invoiceDate &&
    Number.isFinite(billedNumber) &&
    billedNumber > 0 &&
    !submitting;

  const submit = async (dispute?: { ourFigure: string; reason: string }) => {
    if (!baseCanSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createSupplierInvoice({
        supplierId,
        goodsReceiptIds: Array.from(selected),
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate: new Date(invoiceDate).toISOString(),
        amountBilled,
        dispute,
      });
      onRecorded();
      onOpenChange(false);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not record this invoice.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveInvoice = () => submit();
  const handleRecordAtBilled = () => submit({ ourFigure: String(ourFigure), reason: 'Mismatch between receipts and supplier invoice' });
  const handleHold = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={variant === 'mobile' ? 'w-full sm:max-w-full' : undefined}>
        <SheetHeader>
          <SheetTitle>Record supplier invoice</SheetTitle>
          <SheetDescription>{supplierName}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-wds-4.5 overflow-y-auto px-wds-6 py-wds-5">
          {loadingReceipts ? (
            <p className="font-wds-sans text-wds-caption text-wds-text-copy-muted">Loading receipts…</p>
          ) : receipts.length === 0 ? (
            <p className="font-wds-sans text-wds-caption text-wds-text-copy-muted">No receipts awaiting invoice for this supplier.</p>
          ) : (
            <>
              <BundleCheckboxList title="RECEIPTS TO BUNDLE" rows={rows} onToggle={toggle} />
              <BundleRunningTotal label="Our figure" amountLabel={`KES ${ourFigure.toLocaleString()}`} />
            </>
          )}

          <div className="flex gap-wds-3">
            <div className="flex grow flex-col gap-wds-1.5">
              <label htmlFor="invoice-number" className="font-wds-mono text-wds-label text-wds-text-copy-muted">INVOICE NUMBER</label>
              <input
                id="invoice-number"
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-05121"
                className="h-8 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2.5 font-wds-mono text-wds-body-sm text-wds-text-ink placeholder:text-wds-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wds-primary"
              />
            </div>
            <div className="flex grow flex-col gap-wds-1.5">
              <label htmlFor="invoice-date" className="font-wds-mono text-wds-label text-wds-text-copy-muted">INVOICE DATE</label>
              <input
                id="invoice-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="h-8 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2.5 font-wds-mono text-wds-body-sm text-wds-text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wds-primary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-wds-1.5">
            <label htmlFor="amount-billed" className="font-wds-mono text-wds-label text-wds-text-copy-muted">AMOUNT BILLED</label>
            <input
              id="amount-billed"
              type="number"
              min="0"
              step="0.01"
              value={amountBilled}
              onChange={(e) => {
                setAmountTouched(true);
                setAmountBilled(e.target.value);
              }}
              className="h-8 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2.5 font-wds-mono text-wds-body-sm text-wds-text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wds-primary"
            />
          </div>

          {hasMismatch ? (
            <DisputeCallout
              title="Amount doesn't match our figure"
              description={`Supplier billed KES ${billedNumber.toLocaleString()}, our receipts total KES ${ourFigure.toLocaleString()}. Hold to check with the supplier, or record it at the billed amount and open a dispute.`}
              onHold={handleHold}
              onRecordAtBilled={handleRecordAtBilled}
              disabled={submitting}
            />
          ) : null}

          {error ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{error}</p> : null}
        </div>
        {!hasMismatch ? (
          <SheetFooter className="flex-wrap items-center justify-end gap-wds-2">
            <Button variant="secondary" onClick={handleHold} disabled={submitting}>
              Hold
            </Button>
            <Button onClick={handleSaveInvoice} disabled={!baseCanSubmit}>
              {submitting ? 'Saving…' : 'Save invoice'}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
