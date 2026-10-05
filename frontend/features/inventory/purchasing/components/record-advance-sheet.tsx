'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Input } from '@/components/ui2/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { FormErrorBanner } from '../../_shared/components/stock-states';
import { useAction } from '../../_shared/hooks/use-async';
import { useIsNarrow } from '../hooks/use-order';
import { usePurchasing } from '../hooks/use-purchasing';
import { isoDay, kes2 } from '../lib/format';
import type { Order, PayMethod } from '../types';
import { FieldLabel } from './parts';

export const FALLBACK_METHODS: Array<{ method: PayMethod; label: string; detail: string; isDefault: boolean }> = [
  { method: 'BANK_TRANSFER', label: 'Bank transfer', detail: '', isDefault: true },
  { method: 'MPESA_PAYBILL', label: 'M-Pesa Paybill', detail: '', isDefault: false },
  { method: 'CHEQUE', label: 'Cheque', detail: '', isDefault: false },
  { method: 'CASH', label: 'Cash', detail: '', isDefault: false },
];

/**
 * Record advance (Paper `10`): the Accountant (or Store Manager) pays part or all of an order before the goods arrive. It is held
 * against the order and comes off the invoice automatically. The supplier's payment methods come from the order; a role that may
 * not see them still gets the plain list.
 */
export function RecordAdvanceSheet({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { service } = usePurchasing();
  const narrow = useIsNarrow();
  const addToast = useWdsToastStore((s) => s.addToast);
  const total = Number.parseFloat(order.orderedTotal || '0');
  const methods = order.supplier.payMethods.length ? order.supplier.payMethods : FALLBACK_METHODS;
  const [amount, setAmount] = React.useState('');
  const [paidOn, setPaidOn] = React.useState(isoDay(new Date()));
  const [reference, setReference] = React.useState('');
  const [method, setMethod] = React.useState<PayMethod>('BANK_TRANSFER');
  const [chequeNo, setChequeNo] = React.useState('');
  const [fieldError, setFieldError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setAmount('');
      setPaidOn(isoDay(new Date()));
      setReference('');
      setChequeNo('');
      setFieldError(null);
      setMethod((methods.find((m) => m.isDefault) ?? methods[0])?.method ?? 'BANK_TRANSFER');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the drawer opens
  }, [open]);

  const save = useAction(async () => {
    const value = Number.parseFloat(amount);
    if (!(value > 0)) {
      setFieldError('Enter an amount more than zero.');
      return null;
    }
    if (method === 'CHEQUE' && !chequeNo.trim()) {
      setFieldError('Enter the cheque number.');
      return null;
    }
    setFieldError(null);
    const p = await service.recordDeposit(order.id, { amount: String(value), paidOn, method, methodRef: reference.trim() || null, chequeNo: method === 'CHEQUE' ? chequeNo.trim() : null, note: null });
    addToast({ variant: 'success', title: `Advance ${p.reference} recorded`, description: `KES ${kes2(p.amount)} is held against ${order.reference}.` });
    onOpenChange(false);
    return p;
  }, 'We could not save the advance. Try again.');

  return (
    <Sheet open={open} onOpenChange={(o) => (!save.saving ? onOpenChange(o) : undefined)}>
      <SheetContent side={narrow ? 'bottom' : 'right'} className={cn(narrow ? 'max-h-[92vh] rounded-t-wds-lg' : 'w-[460px] max-w-full')}>
        <SheetHeader>
          <SheetTitle className="flex items-baseline gap-2.5 font-wds-sans text-wds-section font-semibold text-wds-neutral-950">
            Record advance
            <span className="font-wds-mono text-wds-caption font-normal text-wds-text-secondary">{order.reference}</span>
          </SheetTitle>
          <SheetDescription className="font-wds-sans text-wds-caption text-wds-text-secondary">{order.supplier.name} · paid before delivery</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-wds-6 py-wds-5">
          {save.failure ? <FormErrorBanner title="We couldn't save the advance" description={save.failure.message} /> : null}
          {fieldError ? <FormErrorBanner title="Check the form" description={fieldError} /> : null}
          <div className="flex items-baseline justify-between border-b border-wds-border pb-3">
            <span className="font-wds-sans text-wds-body-sm text-wds-text-secondary">Order total</span>
            <span className="font-wds-mono text-wds-section text-wds-neutral-950">{kes2(total)}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="adv-amount">Amount (KES)</FieldLabel>
            <Input id="adv-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" className="text-right font-wds-mono" autoFocus />
            <div className="flex gap-1.5">
              {[25, 50, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setAmount((Math.round(total * pct) / 100).toFixed(2))}
                  className="h-6 rounded-[2px] border border-wds-border-strong bg-white px-2.5 font-wds-sans text-[11px] text-wds-text-secondary outline-none hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="adv-date">Paid on</FieldLabel>
              <Input id="adv-date" type="date" value={paidOn} max={isoDay(new Date())} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="adv-ref">Reference</FieldLabel>
              <Input id="adv-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. QDJ4H8K2" className="font-wds-mono" />
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
                    'flex cursor-pointer items-center gap-3 rounded-wds-sm border px-3 py-2.5 transition-colors focus-within:shadow-wds-ring',
                    on ? 'border-wds-primary bg-wds-espresso-50' : 'border-wds-border-strong bg-wds-surface hover:bg-wds-neutral-50'
                  )}
                >
                  <input type="radio" name="advance-method" value={m.method} checked={on} onChange={() => setMethod(m.method)} className="sr-only" />
                  <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border', on ? 'border-wds-primary' : 'border-wds-border-strong')} aria-hidden>
                    {on ? <span className="size-1.5 rounded-full bg-wds-primary" /> : null}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-wds-sans text-wds-body-sm text-wds-neutral-950">
                      {m.label}
                      {m.isDefault ? ' · default' : ''}
                    </span>
                    {m.detail ? <span className="truncate font-wds-sans text-[11px] text-wds-text-secondary">{m.detail}</span> : null}
                  </span>
                </label>
              );
            })}
          </fieldset>
          {method === 'CHEQUE' ? (
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="adv-cheque">Cheque number</FieldLabel>
              <Input id="adv-cheque" value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} placeholder="e.g. 004512" className="font-wds-mono" />
            </div>
          ) : null}
          <p className="rounded-wds-sm border border-wds-info-border bg-wds-info-bg px-3 py-2.5 font-wds-sans text-wds-caption text-wds-info-fg">
            This advance is held against {order.reference}. It comes off the invoice automatically when the invoice is added. If the goods or invoice come to less, the difference stays as credit with {order.supplier.name.split(' ')[0]}.
          </p>
        </div>
        <SheetFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={save.saving}>
            Cancel
          </Button>
          <Button onClick={() => void save.run()} disabled={save.saving}>
            {save.saving ? 'Saving…' : 'Save advance'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
