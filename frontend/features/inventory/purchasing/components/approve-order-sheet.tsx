'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { Textarea } from '@/components/ui2/textarea';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { FormErrorBanner } from '../../_shared/components/stock-states';
import { useAction } from '../../_shared/hooks/use-async';
import { useIsNarrow, useOrder } from '../hooks/use-order';
import { kes, kes2, qty as fmtQty, whenLabel } from '../lib/format';
import type { OrderLine } from '../types';
import { CompactTracker } from './compact-tracker';
import { PinDialog } from './pin-dialog';
import { FieldLabel } from './parts';

/** "▲ 4% on the last order" when the price is above what we paid last time; nothing when it is the same or new. */
export function priceFlag(line: OrderLine): string | null {
  if (!line.previousPrice || !line.unitPrice) return null;
  const was = Number.parseFloat(line.previousPrice);
  const now = Number.parseFloat(line.unitPrice);
  if (!(was > 0) || now === was) return null;
  const pct = Math.round(((now - was) / was) * 100);
  return `${now > was ? '▲' : '▼'} ${Math.abs(pct)}% on the last order`;
}

/**
 * Approve order (Paper `05` drawer, `06` phone sheet): the Store Manager (or System Admin) reads the order, then approves with
 * a PIN or sends it back with a note. The raiser's note is shown; the manager's note is required to send it back.
 */
export function ApproveOrderSheet({ orderId, onClose, onDone }: { orderId: string | null; onClose: () => void; onDone?: () => void }) {
  const narrow = useIsNarrow();
  const addToast = useWdsToastStore((s) => s.addToast);
  const { data: order, status, error, service, role } = useOrder(orderId);
  const [note, setNote] = React.useState('');
  const [noteError, setNoteError] = React.useState(false);
  const [pinOpen, setPinOpen] = React.useState(false);
  const returning = useAction((id: string, text: string) => service.returnOrder(id, text), 'We could not send the order back. Try again.');

  React.useEffect(() => {
    if (orderId) {
      setNote('');
      setNoteError(false);
      returning.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when a different order opens
  }, [orderId]);

  const isAdmin = role === 'SYSTEM_ADMIN';
  const raiserRole = order?.raisedBy.role.replace(/^Store /, '') ?? 'raiser';

  const sendBack = async (): Promise<void> => {
    if (!order) return;
    if (!note.trim()) {
      setNoteError(true);
      return;
    }
    const done = await returning.run(order.id, note);
    if (done) {
      addToast({ variant: 'info', title: `${order.reference} sent back`, description: `${order.raisedBy.name} will see your note.` });
      onClose();
      onDone?.();
    }
  };

  const body = !orderId ? null : status === 'error' ? (
    <FormErrorBanner title="We couldn't load this order" description={error ?? 'Try closing this and opening it again.'} />
  ) : !order ? (
    <div className="flex flex-col gap-3" aria-busy>
      <div className="h-4 w-1/2 animate-pulse rounded bg-wds-neutral-100" />
      <div className="h-24 animate-pulse rounded bg-wds-neutral-100" />
    </div>
  ) : (
    <>
      {returning.failure ? <FormErrorBanner title="We couldn't send it back" description={returning.failure.message} /> : null}
      <CompactTracker tracker={order.tracker} />
      <dl className="grid grid-cols-3 gap-3">
        {[
          ['Supplier', order.supplier.name],
          ['Expected', order.expectedDate ? whenLabel(`${order.expectedDate}T00:00:00`).replace(/ \d\d:\d\d$/, '') : '—'],
          ['Terms', order.supplier.termsDays ? `Invoice · ${order.supplier.termsDays} days` : 'On delivery'],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1">
            <dt className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">{k}</dt>
            <dd className="font-wds-sans text-wds-body-sm text-wds-neutral-950">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col">
        <div className="flex h-[30px] items-center gap-3 border-b border-wds-neutral-950">
          <span className="grow font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-neutral-950">Item</span>
          <span className="w-[70px] text-right font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-neutral-950">Qty</span>
          <span className="w-[70px] text-right font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-neutral-950">Price</span>
          <span className="w-20 text-right font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-neutral-950">Total</span>
        </div>
        {order.lines.map((l) => {
          const flag = priceFlag(l);
          return (
            <div key={l.id} className="flex min-h-[52px] items-center gap-3 border-b border-wds-neutral-100 py-2">
              <div className="flex min-w-0 grow flex-col gap-0.5">
                <span className="truncate font-wds-sans text-wds-body-sm text-wds-neutral-950">{l.itemName}</span>
                {flag ? <span className={cn('font-wds-sans text-[11px] leading-[14px]', flag.startsWith('▲') ? 'text-wds-warning-fg' : 'text-wds-success-fg')}>{flag}</span> : null}
              </div>
              <span className="w-[70px] text-right font-wds-mono text-wds-caption text-wds-text-secondary">
                {fmtQty(l.orderedQty)} {l.buyUnit}
              </span>
              <span className="w-[70px] text-right font-wds-mono text-wds-caption text-wds-text-secondary">{kes(l.unitPrice)}</span>
              <span className="w-20 text-right font-wds-mono text-wds-body-sm text-wds-neutral-950">{kes(l.lineTotal)}</span>
            </div>
          );
        })}
        <div className="flex h-11 items-center justify-between">
          <span className="font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-text-secondary">Total</span>
          <span className="font-wds-mono text-wds-section font-medium text-wds-neutral-950">KES {kes2(order.orderedTotal)}</span>
        </div>
      </div>
      {order.attendantNote ? (
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Note from {order.raisedBy.role}</FieldLabel>
          <p className="rounded-wds-sm border border-wds-border bg-wds-surface-sunken px-3 py-2.5 font-wds-sans text-wds-body-sm text-wds-neutral-950">{order.attendantNote}</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="return-note">Your note (required if you return it)</FieldLabel>
        <Textarea
          id="return-note"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setNoteError(false);
          }}
          placeholder="Why are you sending it back?"
          aria-invalid={noteError || undefined}
          className="min-h-[60px]"
        />
        {noteError ? <span className="font-wds-sans text-wds-caption text-wds-error-fg">Say why you are sending it back.</span> : null}
      </div>
      {isAdmin ? <p className="font-wds-sans text-wds-caption text-wds-text-secondary">You are signed in as System Admin. Approve with your own PIN.</p> : null}
    </>
  );

  return (
    <>
      <Sheet open={orderId !== null} onOpenChange={(o) => (!o && !returning.saving ? onClose() : undefined)}>
        <SheetContent side={narrow ? 'bottom' : 'right'} className={cn(narrow ? 'max-h-[92vh] rounded-t-wds-lg' : 'w-[460px] max-w-full')}>
          <SheetHeader>
            <SheetTitle className="flex items-baseline gap-2.5 font-wds-sans text-wds-section font-semibold text-wds-neutral-950">
              Approve order
              {order?.reference ? <span className="font-wds-mono text-wds-caption font-normal text-wds-text-secondary">{order.reference}</span> : null}
            </SheetTitle>
            <SheetDescription className="font-wds-sans text-wds-caption text-wds-text-secondary">
              {order ? `${narrow ? `${order.supplier.name} · ` : ''}Raised by ${order.raisedBy.role} · ${whenLabel(order.submittedAt)}` : 'Loading the order…'}
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-wds-6 py-wds-5">{body}</div>
          <SheetFooter>
            <Button variant="secondary" onClick={() => void sendBack()} disabled={!order || returning.saving || !order.can.return}>
              {returning.saving ? 'Sending back…' : `Return to ${raiserRole}`}
            </Button>
            <Button onClick={() => setPinOpen(true)} disabled={!order || !order.can.approve || returning.saving}>
              Approve with PIN
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {order ? (
        <PinDialog
          open={pinOpen}
          onOpenChange={setPinOpen}
          title="Approve with your PIN"
          subtitle={isAdmin ? 'You are signed in as System Admin. Approve with your own PIN.' : 'Your signature goes on the printed LPO.'}
          summary={{ title: `${order.reference} · ${order.supplier.name}`, detail: `${order.lines.length} line${order.lines.length === 1 ? '' : 's'} · KES ${kes2(order.orderedTotal)}` }}
          confirmLabel="Approve order"
          onSubmit={async (pin) => {
            const done = await service.approveOrder(order.id, pin);
            setPinOpen(false);
            addToast({ variant: 'success', title: `${done.reference} approved`, description: 'It is ready to send to the supplier.' });
            onClose();
            onDone?.();
          }}
        />
      ) : null}
    </>
  );
}
