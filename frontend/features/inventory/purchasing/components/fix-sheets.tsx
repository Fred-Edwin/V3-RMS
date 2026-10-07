'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Input } from '@/components/ui2/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { Textarea } from '@/components/ui2/textarea';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { usePinStatus } from '@/hooks/usePinStatus';
import { FormErrorBanner } from '../../_shared/components/stock-states';
import { useAction } from '../../_shared/hooks/use-async';
import { useIsNarrow, useSheetOrder } from '../hooks/use-order';
import { usePurchasing } from '../hooks/use-purchasing';
import { dayMonth, kes, kes2, METHOD_LABEL, whenLabel } from '../lib/format';
import type { Order, ReverseReason, VoidReason } from '../types';
import { FieldLabel, InlinePin } from './parts';

/** Label and value rows in the grey info table at the top of a "fix a mistake" drawer. */
function InfoRows({ rows }: { rows: Array<[string, string, boolean?]> }) {
  return (
    <dl className="flex flex-col divide-y divide-wds-border border border-wds-border bg-wds-surface">
      {rows.map(([k, v, mono], i) => (
        <div key={k} className={cn('flex items-baseline justify-between gap-4 px-3.5 py-2.5', i % 2 === 1 && 'bg-wds-surface-sunken')}>
          <dt className="font-wds-sans text-wds-body-sm text-wds-text-secondary">{k}</dt>
          <dd className={cn('text-right text-wds-body-sm text-wds-neutral-950', mono ? 'font-wds-mono' : 'font-wds-sans')}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Shell({
  title,
  reference,
  subtitle,
  open,
  onOpenChange,
  busy,
  children,
  footer,
}: {
  title: string;
  reference: string;
  subtitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const narrow = useIsNarrow();
  return (
    <Sheet open={open} onOpenChange={(o) => (!busy ? onOpenChange(o) : undefined)}>
      <SheetContent side={narrow ? 'bottom' : 'right'} className={cn(narrow ? 'max-h-[92vh] rounded-t-wds-lg' : 'w-[460px] max-w-full')}>
        <SheetHeader>
          <SheetTitle className="flex items-baseline gap-2.5 font-wds-sans text-wds-section font-semibold text-wds-neutral-950">
            {title}
            <span className="font-wds-mono text-wds-caption font-normal text-wds-text-secondary">{reference}</span>
          </SheetTitle>
          <SheetDescription className="font-wds-sans text-wds-caption text-wds-text-secondary">{subtitle}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-wds-6 py-wds-5">{children}</div>
        <SheetFooter>{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const select = 'h-8 rounded-wds-sm border border-wds-border-strong bg-white px-2 font-wds-sans text-wds-body-sm outline-none focus-visible:shadow-wds-ring';

// ------------------------------------------------------------------ void an invoice

const VOID_REASONS: Array<{ value: VoidReason; label: string }> = [
  { value: 'WRONG_AMOUNT', label: 'Wrong amount entered' },
  { value: 'WRONG_SUPPLIER_OR_ORDER', label: 'Entered on the wrong supplier or order' },
  { value: 'DUPLICATE', label: 'Duplicate of another invoice' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Void an invoice (Paper `37`): a reason and the Accountant's own PIN. Only while nothing is paid against it. The invoice is
 * marked Voided and stays on the statement struck through (owner answer, 5 Oct 2026, Q-15); the order goes back to "Delivered,
 * awaiting invoice" so the right invoice can be added straight after.
 */
export function VoidInvoiceSheet({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const order = useSheetOrder(orderId);
  if (!order || !order.invoice) return null;
  return <VoidInvoiceDrawer order={order} open={orderId !== null} onOpenChange={(o) => (!o ? onClose() : undefined)} />;
}

function VoidInvoiceDrawer({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { service } = usePurchasing();
  const addToast = useWdsToastStore((s) => s.addToast);
  const invoice = order.invoice as NonNullable<Order['invoice']>;
  const [reason, setReason] = React.useState<VoidReason>('WRONG_AMOUNT');
  const [pin, setPin] = React.useState('');
  const paid = order.payments.filter((p) => p.kind === 'INVOICE' && p.status === 'RECORDED').reduce((t, p) => t + Number.parseFloat(p.amount), 0);

  React.useEffect(() => {
    if (open) {
      setReason('WRONG_AMOUNT');
      setPin('');
      run.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the drawer opens
  }, [open]);

  const run = useAction(async () => {
    const o = await service.voidInvoice(invoice.id, { reason, pin });
    addToast({ variant: 'info', title: `Invoice ${invoice.number} voided`, description: `${o.reference} is back to Delivered, awaiting invoice. Add the correct invoice.` });
    onOpenChange(false);
    return o;
  }, 'We could not void the invoice. Try again.');
  const wrongPin = run.failure?.code === 'INVALID_PIN';

  return (
    <Shell
      title="Void invoice"
      reference={invoice.number}
      subtitle={`${order.supplier.name} · for ${order.reference} · KES ${kes2(invoice.amount)}`}
      open={open}
      onOpenChange={onOpenChange}
      busy={run.saving}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={run.saving}>
            Keep invoice
          </Button>
          <Button variant="destructive" onClick={() => void run.run()} disabled={run.saving || pin.length < 4 || paid > 0}>
            {run.saving ? 'Voiding…' : 'Void invoice'}
          </Button>
        </>
      }
    >
      {run.failure && !wrongPin ? <FormErrorBanner title="We couldn't void the invoice" description={run.failure.message} /> : null}
      <InfoRows rows={[['Entered by', `${invoice.enteredBy.name} · ${whenLabel(invoice.enteredAt)}`], ['Invoice amount', kes2(invoice.amount), true], ['Paid so far', kes2(paid), true]]} />
      {paid === 0 ? (
        <div className="flex flex-col gap-0.5 border border-wds-success-border bg-wds-success-bg px-3.5 py-3">
          <span className="font-wds-sans text-wds-body-sm font-medium text-wds-success-fg">Not paid yet, so it can be voided.</span>
          <span className="font-wds-sans text-wds-caption text-wds-success-fg">If it had been paid, you would reverse the payment first.</span>
        </div>
      ) : (
        <div role="alert" className="flex flex-col gap-0.5 border border-wds-warning-border bg-wds-warning-bg px-3.5 py-3">
          <span className="font-wds-sans text-wds-body-sm font-medium text-wds-warning-fg">A payment has been recorded against this invoice.</span>
          <span className="font-wds-sans text-wds-caption text-wds-warning-fg">Reverse the payment first, then void the invoice.</span>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="void-reason">Reason (required)</FieldLabel>
        <select id="void-reason" value={reason} onChange={(e) => setReason(e.target.value as VoidReason)} className={select}>
          {VOID_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel>What happens next</FieldLabel>
        <ul className="flex flex-col gap-1 font-wds-sans text-wds-caption text-wds-neutral-800">
          <li>· {invoice.number} is marked Voided and stays on the statement, struck through.</li>
          <li>· {order.reference} goes back to “Delivered, awaiting invoice”.</li>
          <li>· You add the correct invoice straight after.</li>
        </ul>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="void-pin">Your PIN</FieldLabel>
        <InlinePin id="void-pin" value={pin} onChange={setPin} error={wrongPin ? run.failure?.message : null} />
      </div>
    </Shell>
  );
}

// ------------------------------------------------------------------ reverse a payment

const REVERSE_REASONS: Array<{ value: ReverseReason; label: string }> = [
  { value: 'WRONG_REFERENCE', label: 'Wrong reference number' },
  { value: 'WRONG_AMOUNT', label: 'Wrong amount' },
  { value: 'WRONG_INVOICE', label: 'Paid against the wrong invoice' },
  { value: 'PAYMENT_BOUNCED', label: 'Payment bounced or failed' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Reverse a payment (Paper `38`): the Accountant asks, and the Store Manager's PIN approves it in the same drawer. The payment
 * stays on the statement marked Reversed, a linked line of the negative amount is added, the invoice goes back to To pay.
 */
export function ReversePaymentSheet({ orderId, paymentId, onClose }: { orderId: string | null; paymentId: string | null; onClose: () => void }) {
  const order = useSheetOrder(orderId);
  const last = React.useRef<string | null>(null);
  if (paymentId) last.current = paymentId;
  const pid = paymentId ?? last.current;
  const payment = order?.payments.find((p) => p.id === pid);
  if (!order || !payment) return null;
  return <ReversePaymentDrawer order={order} paymentId={payment.id} open={orderId !== null && paymentId !== null} onOpenChange={(o) => (!o ? onClose() : undefined)} />;
}

function ReversePaymentDrawer({ order, paymentId, open, onOpenChange }: { order: Order; paymentId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { service, role } = usePurchasing();
  const addToast = useWdsToastStore((s) => s.addToast);
  const payment = order.payments.find((p) => p.id === paymentId) as NonNullable<Order['payments'][number]>;
  const [reason, setReason] = React.useState<ReverseReason>('WRONG_REFERENCE');
  const [note, setNote] = React.useState('');
  const [pin, setPin] = React.useState('');
  const amount = Number.parseFloat(payment.amount);
  const invoice = order.invoice;
  const approvesOwn = role === 'STORE_MANAGER' || role === 'SYSTEM_ADMIN';
  // An approver signs with their own PIN here; if they have none yet, say where to set it (the Accountant types someone else's).
  const pinStatus = usePinStatus(open && approvesOwn);
  const needsOwnPin = approvesOwn && pinStatus.hasPin === false;

  React.useEffect(() => {
    if (open) {
      setReason('WRONG_REFERENCE');
      setNote('');
      setPin('');
      run.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the drawer opens
  }, [open, paymentId]);

  const run = useAction(async () => {
    const r = await service.reversePayment(payment.id, { reason, note: note.trim() || null, approverPin: pin });
    addToast({ variant: 'info', title: `Payment ${payment.reference} reversed`, description: `${invoice?.number ?? 'The invoice'} is back in To pay with KES ${kes2(r.order.invoice?.balance)} owing. Record the payment again.` });
    onOpenChange(false);
    return r;
  }, 'We could not reverse the payment. Try again.');
  const wrongPin = run.failure?.code === 'INVALID_PIN';

  return (
    <Shell
      title="Reverse payment"
      reference={payment.reference}
      subtitle={`${order.supplier.name} · against ${invoice?.number ?? order.reference}`}
      open={open}
      onOpenChange={onOpenChange}
      busy={run.saving}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={run.saving}>
            Keep payment
          </Button>
          <Button variant="destructive" onClick={() => void run.run()} disabled={run.saving || pin.length < 4}>
            {run.saving ? 'Reversing…' : 'Reverse payment'}
          </Button>
        </>
      }
    >
      {run.failure && !wrongPin ? <FormErrorBanner title="We couldn't reverse the payment" description={run.failure.message} /> : null}
      <InfoRows
        rows={[
          ['Amount paid', kes2(amount), true],
          ['Method', `${payment.chequeNo ? `Cheque ${payment.chequeNo}` : METHOD_LABEL[payment.method]}${payment.methodRef ? ` · ${payment.methodRef}` : ''}`],
          ['Recorded', `${payment.recordedBy.name} · ${whenLabel(payment.recordedAt)}`],
        ]}
      />
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="rev-reason">Reason (required)</FieldLabel>
        <select id="rev-reason" value={reason} onChange={(e) => setReason(e.target.value as ReverseReason)} className={select}>
          {REVERSE_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" className="min-h-14" />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel>What happens next</FieldLabel>
        <ul className="flex flex-col gap-1 font-wds-sans text-wds-caption text-wds-neutral-800">
          <li>· {payment.reference} stays on the statement, marked Reversed.</li>
          <li>· A new line of −{kes2(amount)} is added, linked to it.</li>
          <li>
            · {invoice?.number ?? 'The invoice'} goes back to “To pay” with {kes2(Number.parseFloat(invoice?.balance ?? '0') + amount)} owing.
          </li>
          <li>· You record the payment again with the right details.</li>
        </ul>
      </div>
      <div className="flex flex-col gap-2 border border-wds-warning-border bg-wds-warning-bg px-3.5 py-3">
        <span className="font-wds-sans text-wds-body-sm font-medium text-wds-warning-fg">{approvesOwn ? 'Needs a Store Manager’s PIN' : 'Needs the Store Manager’s approval'}</span>
        <div className="flex items-start gap-3">
          <label htmlFor="rev-pin" className="pt-2 font-wds-sans text-wds-caption text-wds-warning-fg">
            {role === 'SYSTEM_ADMIN' ? 'Your own PIN' : approvesOwn ? 'Your PIN' : 'The Store Manager’s PIN'}
          </label>
          <InlinePin id="rev-pin" value={pin} onChange={setPin} error={wrongPin ? run.failure?.message : null} />
        </div>
        {role === 'SYSTEM_ADMIN' ? <span className="font-wds-sans text-[11px] text-wds-warning-fg">You are signed in as System Admin. Approve with your own PIN.</span> : null}
        {needsOwnPin ? (
          <span className="font-wds-sans text-wds-caption text-wds-warning-fg">
            You haven’t set a PIN yet.{' '}
            <Link href="/app/profile" className="font-medium underline underline-offset-2">
              Set your signing PIN in Profile
            </Link>
            , then come back.
          </span>
        ) : null}
      </div>
    </Shell>
  );
}

// ------------------------------------------------------------------ settle a dispute

/**
 * Settle a disputed invoice (Q-06 default, not in Paper, built from the same drawer pattern): agree the figure with the supplier
 * first, then record it here. The invoice takes the agreed amount and the dispute clears; the note stays in the audit log.
 */
export function SettleDisputeSheet({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const order = useSheetOrder(orderId);
  if (!order || !order.invoice) return null;
  return <SettleDisputeDrawer order={order} open={orderId !== null} onOpenChange={(o) => (!o ? onClose() : undefined)} />;
}

function SettleDisputeDrawer({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { service } = usePurchasing();
  const addToast = useWdsToastStore((s) => s.addToast);
  const invoice = order.invoice as NonNullable<Order['invoice']>;
  const delivered = Number.parseFloat(order.deliveredTotal ?? '0');
  const [agreed, setAgreed] = React.useState('');
  const [note, setNote] = React.useState('');
  const value = Number.parseFloat(agreed);
  const first = order.supplier.name.split(' ')[0];

  React.useEffect(() => {
    if (open) {
      setAgreed('');
      setNote('');
      run.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the drawer opens
  }, [open]);

  const run = useAction(async () => {
    const inv = await service.settleDispute(invoice.id, { agreedAmount: String(value), note });
    addToast({ variant: 'success', title: `Dispute on ${inv.number} settled`, description: `Agreed at KES ${kes2(inv.amount)}. It can be paid now.` });
    onOpenChange(false);
    return inv;
  }, 'We could not settle the dispute. Try again.');

  return (
    <Shell
      title="Settle dispute"
      reference={invoice.number}
      subtitle={`${order.supplier.name} · ${order.reference}`}
      open={open}
      onOpenChange={onOpenChange}
      busy={run.saving}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={run.saving}>
            Cancel
          </Button>
          <Button onClick={() => void run.run()} disabled={run.saving || !(value > 0) || !note.trim()}>
            {run.saving ? 'Saving…' : 'Settle dispute'}
          </Button>
        </>
      }
    >
      {run.failure ? <FormErrorBanner title="We couldn't settle the dispute" description={run.failure.message} /> : null}
      <InfoRows
        rows={[
          ['Delivered value', kes2(delivered), true],
          ['Invoice amount', kes2(invoice.amount), true],
          ['Difference', `${Number.parseFloat(invoice.varianceAmount ?? '0') > 0 ? '+' : '−'}${kes2(Math.abs(Number.parseFloat(invoice.varianceAmount ?? '0')))}`, true],
          ['Reason given', invoice.varianceReason ?? '—'],
        ]}
      />
      <p className="font-wds-sans text-wds-caption text-wds-text-secondary">Agree the figure with {first} first, then record it here. The invoice takes the agreed amount and can then be paid.</p>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="settle-amount">Agreed amount (KES)</FieldLabel>
        <Input id="settle-amount" inputMode="decimal" value={agreed} onChange={(e) => setAgreed(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" className="font-wds-mono" autoFocus />
        <div className="flex gap-1.5">
          {[
            ['Delivered value', delivered],
            ['Invoice amount', Number.parseFloat(invoice.amount)],
          ].map(([label, v]) => (
            <button
              key={label as string}
              type="button"
              onClick={() => setAgreed((v as number).toFixed(2))}
              className="h-6 rounded-[2px] border border-wds-border-strong bg-white px-2.5 font-wds-sans text-[11px] text-wds-text-secondary outline-none hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
            >
              {label as string} · {kes(v as number)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="settle-note">What was agreed (required)</FieldLabel>
        <Textarea id="settle-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={`e.g. ${first} agreed to drop the delivery charge.`} className="min-h-20" />
      </div>
      <p className="font-wds-sans text-[11px] text-wds-text-secondary">Due {dayMonth(invoice.dueDate)}. This is kept in the audit log.</p>
    </Shell>
  );
}
