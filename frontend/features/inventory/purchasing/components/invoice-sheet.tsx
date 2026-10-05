'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { Input } from '@/components/ui2/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { Textarea } from '@/components/ui2/textarea';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { FormErrorBanner } from '../../_shared/components/stock-states';
import { useAction } from '../../_shared/hooks/use-async';
import { useIsNarrow, useSheetOrder } from '../hooks/use-order';
import { usePurchasing } from '../hooks/use-purchasing';
import { fullDate, isoDay, kes, kes2 } from '../lib/format';
import type { FileRef, Order } from '../types';
import { CompactTracker } from './compact-tracker';
import { FieldLabel } from './parts';
import { PhotoSlot } from './photo-slot';

const addDays = (iso: string, days: number): string => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** One row of the figures box: label left, figure right. */
function FigureRow({ label, value, tone, strong }: { label: string; value: string; tone?: 'warning' | 'info'; strong?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between px-3.5 py-2.5', strong && 'bg-wds-surface-sunken')}>
      <span className={cn('font-wds-sans text-wds-body-sm', strong ? 'font-semibold text-wds-neutral-950' : tone === 'warning' ? 'text-wds-warning-fg' : tone === 'info' ? 'text-wds-info-fg' : 'text-wds-text-secondary')}>{label}</span>
      <span className={cn('font-wds-mono text-wds-body-sm', tone === 'warning' ? 'text-wds-warning-fg' : tone === 'info' ? 'text-wds-info-fg' : 'text-wds-neutral-950')}>{value}</span>
    </div>
  );
}

/**
 * Add invoice (Paper `17` empty, `18` filled, `34` higher than the delivery). One invoice per order. The figures box compares the
 * invoice with what was delivered; a difference needs a reason and saves the invoice as disputed until it is settled. A duplicate
 * number from the same supplier is warned about (`40`), and closing with typed content asks first (`40d`).
 */
export function AddInvoiceSheet({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const order = useSheetOrder(orderId);
  if (!order) return null;
  return <AddInvoiceDrawer order={order} open={orderId !== null} onOpenChange={(o) => (!o ? onClose() : undefined)} />;
}

function AddInvoiceDrawer({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { service } = usePurchasing();
  const narrow = useIsNarrow();
  const addToast = useWdsToastStore((s) => s.addToast);
  const [number, setNumber] = React.useState('');
  const [date, setDate] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [photo, setPhoto] = React.useState<FileRef | null>(null);
  const [reason, setReason] = React.useState('');
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);

  const delivered = Number.parseFloat(order.deliveredTotal ?? order.money?.delivered ?? '0');
  const advance = order.payments.filter((p) => p.kind === 'ADVANCE' && p.status === 'RECORDED').reduce((t, p) => t + Number.parseFloat(p.amount), 0);
  const value = Number.parseFloat(amount);
  const hasAmount = Number.isFinite(value) && value > 0;
  const variance = hasAmount ? Math.round((value - delivered) * 100) / 100 : 0;
  const differs = hasAmount && Math.abs(variance) >= 0.005;
  const applied = hasAmount ? Math.min(advance, value) : advance;
  const balance = hasAmount ? Math.max(value - applied, 0) : 0;
  const terms = order.supplier.termsDays;
  const dirty = Boolean(number || date || amount || photo || reason);
  const first = order.supplier.name.split(' ')[0];

  React.useEffect(() => {
    if (open) {
      setNumber('');
      setDate('');
      setAmount('');
      setPhoto(null);
      setReason('');
      setFieldError(null);
      save.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the drawer opens
  }, [open]);

  const save = useAction(async (different: boolean) => {
    if (!number.trim() || !date || !hasAmount) {
      setFieldError('Enter the invoice number, its date and the amount.');
      return null;
    }
    if (differs && !reason.trim()) {
      setFieldError('Say why the invoice differs from what was delivered.');
      return null;
    }
    setFieldError(null);
    const inv = await service.addInvoice(order.id, { number: number.trim(), date, amount: String(value), photoId: photo?.id ?? null, varianceReason: differs ? reason.trim() : null, differentInvoice: different });
    addToast(
      inv.disputed
        ? { variant: 'info', title: `Invoice ${inv.number} saved as disputed`, description: `KES ${kes2(Math.abs(Number.parseFloat(inv.varianceAmount ?? '0')))} ${Number.parseFloat(inv.varianceAmount ?? '0') > 0 ? 'above' : 'below'} the delivery. Settle it with ${first} before paying.` }
        : { variant: 'success', title: `Invoice ${inv.number} added`, description: `Balance to pay KES ${kes2(inv.balance)}.` }
    );
    onOpenChange(false);
    return inv;
  }, 'We could not save the invoice. Try again.');

  const duplicate = save.failure?.code === 'DUPLICATE_INVOICE_NUMBER' ? (save.failure.details as { existingOrderId?: string; existingReference?: string }) : null;
  const requestClose = (next: boolean): void => {
    if (save.saving) return;
    if (!next && dirty) setConfirmDiscard(true);
    else onOpenChange(next);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent side={narrow ? 'bottom' : 'right'} className={cn(narrow ? 'max-h-[92vh] rounded-t-wds-lg' : 'w-[460px] max-w-full')}>
          <SheetHeader>
            <SheetTitle className="flex items-baseline gap-2.5 font-wds-sans text-wds-section font-semibold text-wds-neutral-950">
              Add invoice
              <span className="font-wds-mono text-wds-caption font-normal text-wds-text-secondary">{order.reference}</span>
            </SheetTitle>
            <SheetDescription className="font-wds-sans text-wds-caption text-wds-text-secondary">{order.supplier.name} · one invoice per order</SheetDescription>
          </SheetHeader>
          <div className="border-b border-wds-border bg-wds-surface-sunken px-wds-6 py-3">
            <CompactTracker tracker={order.tracker} />
          </div>
          <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-wds-6 py-wds-5">
            {save.failure && !duplicate ? <FormErrorBanner title="We couldn't save the invoice" description={save.failure.message} /> : null}
            {fieldError ? <FormErrorBanner title="Check the form" description={fieldError} /> : null}
            {duplicate ? (
              <div role="alert" className="flex flex-col gap-3 border border-wds-warning-border bg-wds-warning-bg p-3.5">
                <div className="flex flex-col gap-1">
                  <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-warning-fg">
                    {number.trim()} is already recorded{duplicate.existingReference ? ` for ${duplicate.existingReference}` : ''}.
                  </span>
                  <span className="font-wds-sans text-wds-caption text-wds-warning-fg">Adding it again would count the same invoice twice.</span>
                </div>
                <div className="flex gap-2">
                  {duplicate.existingOrderId ? (
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/app/inventory/purchasing/${duplicate.existingOrderId}`}>Open it</Link>
                    </Button>
                  ) : null}
                  <Button variant="secondary" size="sm" onClick={() => void save.run(true)} disabled={save.saving}>
                    This is a different invoice
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="inv-number">Invoice number</FieldLabel>
                <Input id="inv-number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="e.g. INV-05188" className="font-wds-mono" autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="inv-date">Invoice date</FieldLabel>
                <Input id="inv-date" type="date" value={date} max={isoDay(new Date())} onChange={(e) => setDate(e.target.value)} className="font-wds-mono" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="inv-amount">Invoice amount (KES)</FieldLabel>
              <Input id="inv-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" className="font-wds-mono" />
              <p className="font-wds-sans text-[11px] leading-[15px] text-wds-text-secondary">
                {hasAmount && date && terms !== null ? `Due ${fullDate(addDays(date, terms))} (${first}'s terms: ${terms} days). ` : ''}
                {!hasAmount ? `Delivered value is KES ${kes(delivered)}.${advance > 0 ? ` The advance of KES ${kes(advance)} will be taken off.` : ''}` : ''}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Photo or PDF of the invoice</FieldLabel>
              <PhotoSlot idPrefix="inv" value={photo} onChange={setPhoto} />
            </div>
            {hasAmount ? (
              <div className="flex flex-col divide-y divide-wds-border border border-wds-border bg-wds-surface" aria-label="Invoice figures">
                <FigureRow label="Delivered value" value={kes(delivered)} />
                {differs ? <FigureRow label={variance > 0 ? 'Invoice is higher by' : 'Invoice is lower by'} value={`${variance > 0 ? '+' : '−'}${kes(Math.abs(variance))}`} tone="warning" /> : null}
                {applied > 0 ? <FigureRow label="Advance applied" value={`−${kes(applied)}`} tone="info" /> : null}
                <FigureRow label="Balance to pay" value={kes(balance)} strong />
              </div>
            ) : null}
            {differs ? (
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="inv-reason" className="text-wds-warning-fg">
                  Reason for the difference (required)
                </FieldLabel>
                <Textarea id="inv-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Supplier charged delivery that was not agreed." className="min-h-20 border-wds-warning-border" />
                <p className="font-wds-sans text-[11px] leading-[15px] text-wds-text-secondary">The invoice is saved as disputed for KES {kes(Math.abs(variance))} until you settle it with the supplier.</p>
              </div>
            ) : null}
          </div>
          <SheetFooter>
            <Button variant="secondary" onClick={() => requestClose(false)} disabled={save.saving}>
              Cancel
            </Button>
            <Button onClick={() => void save.run(false)} disabled={save.saving || !number.trim() || !date || !hasAmount || (differs && !reason.trim())}>
              {save.saving ? 'Saving…' : 'Save invoice'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this invoice?"
        description="What you typed will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmDiscard(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
