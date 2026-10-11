'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { roleLabel } from '@/components/app/shell/role-label';
import { useWdsToastStore } from '@/store/wdsToastStore';
import type { AppRole } from '@/types/auth';
import { useAction } from '../../../_shared/hooks/use-async';
import { usePurchasing } from '../../hooks/use-purchasing';
import { qty } from '../../lib/format';
import type { PurchaseFile } from '../../types';
import { PURCHASING } from './order-cards';
import { OrderFrame, WithdrawDialog } from './order-parts';
import { AddOrStepper } from './restock-list-screen';
import { Banner, DangerTextAction, ItemsCard, Label, PhoneBar, PrimaryButton, WriteError, timeHmm, withRole } from './phone-kit';

/** 28H: sent back (or still a draft). Fix the quantities, reply if you want to, send it for approval again, or withdraw it. */
export function ReturnedOrder({ order }: { order: PurchaseFile }) {
  const router = useRouter();
  const addToast = useWdsToastStore((s) => s.addToast);
  const { service } = usePurchasing();
  const [qtys, setQtys] = React.useState<Record<string, string>>(() => Object.fromEntries(order.lines.map((l) => [l.id, l.orderedQty])));
  const [reply, setReply] = React.useState('');
  const [confirm, setConfirm] = React.useState(false);
  const resend = useAction(async () => {
    // Two calls: the lines (and the reply, which replaces the first note), then the submit.
    await service.updateOrder(order.id, {
      lines: order.lines.map((l) => ({ inventoryItemId: l.inventoryItemId, qty: qtys[l.id] ?? l.orderedQty, unitPrice: l.unitPrice })),
      ...(reply.trim() ? { attendantNote: reply.trim() } : {}),
    });
    return service.submitOrder(order.id);
  }, 'We could not send this for approval. Nothing was changed.');
  const withdraw = useAction(() => service.withdrawOrder(order.id), 'We could not withdraw this order. Nothing was changed.');

  // Who sent it back, and when, comes from the order's own history (the row carries only a name).
  const returned = [...order.activity].sort((a, b) => b.at.localeCompare(a.at)).find((a) => a.action === 'Returned order');
  const returner = returned?.actor ?? (order.returnedBy ? { ...order.returnedBy, role: 'STORE_MANAGER' } : null);
  const firstName = returner?.name.split(' ')[0] ?? 'the Store Manager';
  const roleWord = returner ? roleLabel(returner.role as AppRole) : 'Store Manager';

  const onResend = async (): Promise<void> => {
    const done = await resend.run();
    if (done) addToast({ variant: 'success', title: 'Sent for approval again', description: `${order.reference ?? 'The order'} is waiting for ${withRole(returner)}.` });
  };
  const onWithdraw = async (): Promise<void> => {
    const done = await withdraw.run();
    if (done) {
      setConfirm(false);
      addToast({ variant: 'success', title: `${order.reference ?? 'Order'} withdrawn` });
      router.replace(`${PURCHASING}/my-orders`);
    }
  };

  return (
    <OrderFrame
      order={order}
      subtitle={`${order.reference ?? 'Draft'} · ${order.status === 'DRAFT' ? 'draft, not yet sent' : 'returned, not yet approved'}`}
      tracker="dots"
      bar={
        <PhoneBar>
          {resend.failure ? <WriteError>{resend.failure.message}</WriteError> : null}
          <PrimaryButton onClick={() => void onResend()} disabled={resend.saving || !order.can.submit} aria-busy={resend.saving}>
            {resend.saving ? 'Sending…' : 'Send for approval again'}
          </PrimaryButton>
          {order.can.withdraw ? <DangerTextAction onClick={() => setConfirm(true)}>Withdraw this order</DangerTextAction> : null}
        </PhoneBar>
      }
    >
      {order.status === 'RETURNED' ? (
        <Banner tone="warning" small title={`${withRole(returner)} sent this back${returned ? ` · ${timeHmm(returned.at)}` : ''}`}>
          {order.returnedNote ? `“${order.returnedNote}”` : 'Look at the quantities, change what is needed, and send it again.'}
        </Banner>
      ) : null}
      <ItemsCard heading={`ITEMS · ${order.lines.length}`} labelId="order-items">
        {order.lines.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 border-b border-wds-border px-3.5 py-2.5 last:border-b-0">
            <div className="min-w-0">
              <p className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{l.itemName}</p>
              <p className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">{l.buyUnit}</p>
            </div>
            <AddOrStepper floor name={l.itemName} onList buyUnit={l.buyUnit} suggested={qty(l.orderedQty)} qtyValue={qtys[l.id] ?? l.orderedQty} onAdd={() => undefined} onSet={(n) => setQtys((prev) => ({ ...prev, [l.id]: String(Math.max(1, n)) }))} />
          </li>
        ))}
      </ItemsCard>
      <div className="flex flex-col gap-1.5">
        <Label>
          REPLY TO {firstName}, {roleWord} (OPTIONAL)
        </Label>
        <textarea
          aria-label={`Reply to ${firstName}, ${roleWord}, optional`}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full resize-none border border-wds-border-strong bg-white px-3 py-2.5 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink outline-none focus-visible:border-[var(--wds-primary-btn-start)] focus-visible:shadow-wds-ring"
        />
      </div>
      <WithdrawDialog open={confirm} onOpenChange={setConfirm} reference={order.reference} busy={withdraw.saving} error={withdraw.failure?.message ?? null} onConfirm={() => void onWithdraw()} />
    </OrderFrame>
  );
}
