'use client';

import * as React from 'react';
import Link from 'next/link';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CheckCircle2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { Input } from '@/components/ui2/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { FormErrorBanner } from '../../_shared/components/stock-states';
import { useAction } from '../../_shared/hooks/use-async';
import { useIsNarrow, useSheetOrder } from '../hooks/use-order';
import { usePurchasing } from '../hooks/use-purchasing';
import { dayMonth, isoDay, kes, kes2, METHOD_LABEL } from '../lib/format';
import type { FileRef, Order, PayMethod, PaymentResult } from '../types';
import { CompactTracker } from './compact-tracker';
import { FieldLabel } from './parts';
import { PhotoSlot } from './photo-slot';
import { FALLBACK_METHODS } from './record-advance-sheet';

/** A row in the figures box. */
function Row({ label, value, tone, strong }: { label: string; value: string; tone?: 'info'; strong?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between px-3.5 py-2.5', strong && 'bg-wds-surface-sunken')}>
      <span className={cn('font-wds-sans text-wds-body-sm', strong ? 'font-semibold text-wds-neutral-950' : tone === 'info' ? 'text-wds-info-fg' : 'text-wds-text-secondary')}>{label}</span>
      <span className={cn('font-wds-mono text-wds-body-sm', tone === 'info' ? 'text-wds-info-fg' : 'text-wds-neutral-950')}>{value}</span>
    </div>
  );
}

/**
 * Record payment (Paper `20`, `20b` by cheque). The Accountant pays an invoice by bank, M-Pesa, cheque or cash; the amount starts at
 * the full balance. Saving asks to confirm (`39`), then shows the payment advice to print. Paying more than the balance is blocked
 * here as Paper `40` draws it ("Enter 17,986 or less"); the contract still has `confirmOverpay` for the back-end session to decide.
 */
export function RecordPaymentSheet({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const order = useSheetOrder(orderId);
  if (!order || !order.invoice) return null;
  return <RecordPaymentDrawer order={order} open={orderId !== null} onOpenChange={(o) => (!o ? onClose() : undefined)} />;
}

function RecordPaymentDrawer({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { service } = usePurchasing();
  const narrow = useIsNarrow();
  const addToast = useWdsToastStore((s) => s.addToast);
  const invoice = order.invoice as NonNullable<Order['invoice']>;
  const balance = Number.parseFloat(invoice.balance);
  const methods = order.supplier.payMethods.length ? order.supplier.payMethods : FALLBACK_METHODS;
  const [amount, setAmount] = React.useState('');
  const [paidOn, setPaidOn] = React.useState(isoDay(new Date()));
  const [reference, setReference] = React.useState('');
  const [chequeNo, setChequeNo] = React.useState('');
  const [method, setMethod] = React.useState<PayMethod>('BANK_TRANSFER');
  const [proof, setProof] = React.useState<FileRef | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<PaymentResult | null>(null);

  const value = Number.parseFloat(amount);
  const valid = Number.isFinite(value) && value > 0;
  const tooMuch = valid && value > balance + 0.005;
  const picked = methods.find((m) => m.method === method);
  const isCheque = method === 'CHEQUE';
  const first = order.supplier.name.split(' ')[0];
  const dirty = !done && (proof !== null || reference !== '' || chequeNo !== '' || (amount !== '' && Math.abs((Number.parseFloat(amount) || 0) - balance) > 0.005));

  React.useEffect(() => {
    if (open) {
      setAmount(balance.toFixed(2));
      setPaidOn(isoDay(new Date()));
      setReference('');
      setChequeNo('');
      setProof(null);
      setFieldError(null);
      setDone(null);
      setConfirmOpen(false);
      setMethod((methods.find((m) => m.isDefault) ?? methods[0])?.method ?? 'BANK_TRANSFER');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the drawer opens
  }, [open, order.id]);

  const pay = useAction(async () => {
    const result = await service.recordPayment(invoice.id, {
      amount: String(value),
      paidOn,
      method,
      methodRef: !isCheque ? reference.trim() || null : null,
      chequeNo: isCheque ? chequeNo.trim() : null,
      proofPhotoId: proof?.id ?? null,
    });
    setConfirmOpen(false);
    setDone(result);
    addToast({ variant: 'success', title: `Payment ${result.payment.reference} recorded`, description: result.order.status === 'CLOSED' ? `${order.reference} is paid in full and closed.` : `KES ${kes2(result.order.invoice?.balance)} still owing on ${invoice.number}.` });
    return result;
  }, 'We could not record the payment. Try again.');

  const review = (): void => {
    if (!valid) return setFieldError('Enter an amount more than zero.');
    if (tooMuch) return setFieldError(`That is more than the balance of KES ${kes2(balance)}. Enter ${kes(balance)} or less.`);
    if (isCheque && !chequeNo.trim()) return setFieldError('Enter the cheque number.');
    if (!paidOn) return setFieldError('Enter the date you paid.');
    setFieldError(null);
    pay.clear();
    setConfirmOpen(true);
  };

  const requestClose = (next: boolean): void => {
    if (pay.saving) return;
    if (!next && dirty) setDiscardOpen(true);
    else onOpenChange(next);
  };
  const advanceRef = order.payments.find((p) => p.kind === 'ADVANCE' && p.status === 'RECORDED')?.reference;
  const advanceApplied = Number.parseFloat(invoice.advanceApplied);

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent side={narrow ? 'bottom' : 'right'} className={cn(narrow ? 'max-h-[92vh] rounded-t-wds-lg' : 'w-[460px] max-w-full')}>
          <SheetHeader>
            <SheetTitle className="flex items-baseline gap-2.5 font-wds-sans text-wds-section font-semibold text-wds-neutral-950">
              Record payment
              <span className="font-wds-mono text-wds-caption font-normal text-wds-text-secondary">{invoice.number}</span>
            </SheetTitle>
            <SheetDescription className="font-wds-sans text-wds-caption text-wds-text-secondary">
              {order.supplier.name} · {order.reference} · due {dayMonth(invoice.dueDate)}
            </SheetDescription>
          </SheetHeader>
          <div className="border-b border-wds-border bg-wds-surface-sunken px-wds-6 py-3">
            <CompactTracker tracker={order.tracker} />
          </div>

          {done ? (
            <div className="flex min-h-0 grow flex-col gap-4 overflow-y-auto px-wds-6 py-wds-5">
              <div role="status" className="flex items-start gap-3 border border-wds-success-border bg-wds-success-bg p-3.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-wds-success-fg" aria-hidden />
                <div className="flex flex-col gap-1">
                  <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-success-fg">Payment {done.payment.reference} recorded</span>
                  <span className="font-wds-sans text-wds-caption text-wds-success-fg">
                    KES {kes2(done.payment.amount)} to {order.supplier.name} · {done.payment.chequeNo ? `Cheque ${done.payment.chequeNo}` : METHOD_LABEL[done.payment.method]}.{' '}
                    {done.order.status === 'CLOSED' ? `${order.reference} is paid in full and closed.` : `KES ${kes2(done.order.invoice?.balance)} is still owing.`}
                  </span>
                </div>
              </div>
              <p className="font-wds-sans text-wds-caption text-wds-text-secondary">Payment advice {done.payment.reference} is ready. Print it or save it as a PDF to send to {first}.</p>
            </div>
          ) : (
            <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-wds-6 py-wds-5">
              {fieldError ? <FormErrorBanner title="Check the form" description={fieldError} /> : null}
              <div className="flex flex-col divide-y divide-wds-border border border-wds-border bg-wds-surface" aria-label="Invoice figures">
                <Row label="Invoice" value={kes(invoice.amount)} />
                {advanceApplied > 0 ? <Row label="Advance already paid" value={`−${kes(advanceApplied)}`} tone="info" /> : null}
                {order.payments.some((p) => p.kind === 'INVOICE' && p.status === 'RECORDED') ? <Row label="Paid so far" value={`−${kes(order.payments.filter((p) => p.kind === 'INVOICE' && p.status === 'RECORDED').reduce((t, p) => t + Number.parseFloat(p.amount), 0))}`} tone="info" /> : null}
                <Row label="Balance due" value={kes(balance)} strong />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="pay-amount">Amount paid now (KES)</FieldLabel>
                <div className={cn('flex h-8 items-center border bg-white px-2.5 focus-within:shadow-wds-ring', tooMuch ? 'border-wds-error-fg' : 'border-wds-primary')}>
                  <input
                    id="pay-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    aria-invalid={tooMuch || undefined}
                    className="min-w-0 grow bg-transparent font-wds-mono text-wds-body-sm text-wds-neutral-950 outline-none"
                  />
                  <button type="button" onClick={() => setAmount(balance.toFixed(2))} className="font-wds-sans text-[11px] text-wds-text-secondary outline-none hover:text-wds-neutral-950 focus-visible:underline">
                    Full balance
                  </button>
                </div>
                {tooMuch ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">That is more than the balance of KES {kes2(balance)}. Enter {kes(balance)} or less.</p> : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="pay-date">Paid on</FieldLabel>
                  <Input id="pay-date" type="date" value={paidOn} max={isoDay(new Date())} onChange={(e) => setPaidOn(e.target.value)} className="font-wds-mono" />
                </div>
                <div className="flex flex-col gap-1.5">
                  {isCheque ? (
                    <>
                      <FieldLabel htmlFor="pay-cheque">Cheque number</FieldLabel>
                      <Input id="pay-cheque" value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} placeholder="e.g. 000412" className="font-wds-mono" />
                    </>
                  ) : (
                    <>
                      <FieldLabel htmlFor="pay-ref">Reference</FieldLabel>
                      <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. EFT-20281" className="font-wds-mono" />
                    </>
                  )}
                </div>
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-text-secondary">Pay using</legend>
                {methods.map((m) => {
                  const on = m.method === method;
                  return (
                    <label
                      key={m.method}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 border px-3 py-2.5 transition-colors focus-within:shadow-wds-ring',
                        on ? 'border-wds-primary bg-wds-espresso-50' : 'border-wds-border-strong bg-wds-surface hover:bg-wds-neutral-50'
                      )}
                    >
                      <input type="radio" name="payment-method" value={m.method} checked={on} onChange={() => setMethod(m.method)} className="sr-only" />
                      <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border', on ? 'border-wds-primary' : 'border-wds-border-strong')} aria-hidden>
                        {on ? <span className="size-1.5 rounded-full bg-wds-primary" /> : null}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="font-wds-sans text-wds-body-sm text-wds-neutral-950">
                          {m.label}
                          {m.isDefault ? ' · default' : ''}
                        </span>
                        {m.detail ? <span className="truncate font-wds-mono text-[11px] text-wds-text-secondary">{m.detail}</span> : null}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Proof of payment (optional)</FieldLabel>
                <PhotoSlot idPrefix="pay" value={proof} onChange={setProof} compact label="Add a screenshot or slip" />
              </div>
              <p className="font-wds-sans text-[11px] leading-[15px] text-wds-text-secondary">Saving creates a payment advice for {first}. You can print it or share it as a PDF straight after.</p>
            </div>
          )}

          <SheetFooter>
            {done ? (
              <>
                <Button variant="secondary" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
                <Button asChild>
                  <Link href={`/app/inventory/purchasing-print/payment/${done.payment.id}`} target="_blank">
                    Print payment advice
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => requestClose(false)}>
                  Cancel
                </Button>
                <Button onClick={review} disabled={!valid || tooMuch}>
                  {tooMuch ? `Pay KES ${kes2(value)}` : 'Save payment'}
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <DialogPrimitive.Root open={confirmOpen} onOpenChange={(o) => (!pay.saving ? setConfirmOpen(o) : undefined)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-wds-scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[60] flex w-[460px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col border border-wds-border-strong bg-wds-surface outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <div className="flex flex-col gap-1 border-b border-wds-border px-5 pb-3.5 pt-4">
              <DialogPrimitive.Title className="font-wds-sans text-wds-section font-semibold text-wds-neutral-950">Confirm payment</DialogPrimitive.Title>
              <DialogPrimitive.Description className="font-wds-sans text-wds-caption text-wds-text-secondary">Check these before you pay. A payment can be reversed, but it takes an approval.</DialogPrimitive.Description>
            </div>
            <div className="flex flex-col gap-4 px-5 py-4">
              {pay.failure ? <FormErrorBanner title="We couldn't record the payment" description={pay.failure.message} /> : null}
              <dl className="flex flex-col divide-y divide-wds-border border border-wds-border">
                {[
                  ['Pay', order.supplier.name],
                  ['By', `${isCheque ? `Cheque ${chequeNo.trim()}` : (picked?.label ?? METHOD_LABEL[method])}${!isCheque && picked?.detail ? ` · ${picked.detail}` : ''}`],
                  ...(!isCheque && reference.trim() ? [['Reference', reference.trim()]] : []),
                  ['For', `${invoice.number} · ${order.reference}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 px-3.5 py-2.5">
                    <dt className="font-wds-sans text-wds-body-sm text-wds-text-secondary">{k}</dt>
                    <dd className={cn('text-right text-wds-body-sm text-wds-neutral-950', k === 'Reference' ? 'font-wds-mono' : 'font-wds-sans')}>{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex items-center justify-between border-y-2 border-wds-neutral-950 py-2.5">
                <span className="font-wds-mono text-[10px] uppercase tracking-[0.08em] text-wds-text-secondary">You are paying</span>
                <span className="font-wds-mono text-[20px] font-semibold text-wds-neutral-950">KES {kes2(value)}</span>
              </div>
              <p className="font-wds-sans text-wds-caption text-wds-text-secondary">
                {advanceApplied > 0 ? `The advance${advanceRef ? ` ${advanceRef}` : ''} of ${kes2(advanceApplied)} is already counted. ` : ''}The balance on {invoice.number} after this payment is {kes2(Math.max(balance - (Number.isFinite(value) ? value : 0), 0))}.
              </p>
            </div>
            <div className="flex justify-end gap-2.5 border-t border-wds-border px-5 py-3.5">
              <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={pay.saving}>
                Go back and edit
              </Button>
              <Button onClick={() => void pay.run()} disabled={pay.saving}>
                {pay.saving ? 'Recording…' : `Pay KES ${kes2(value)}`}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard this payment?"
        description="What you typed will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setDiscardOpen(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
