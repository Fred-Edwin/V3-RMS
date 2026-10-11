'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useWdsToastStore } from '@/store/wdsToastStore';
import { B2Header } from '../../../_shared/components/block2-phone-parts';
import { useAction } from '../../../_shared/hooks/use-async';
import { useOrder } from '../../hooks/use-order';
import { usePurchasing } from '../../hooks/use-purchasing';
import { kes, qty } from '../../lib/format';
import type { PurchaseFile } from '../../types';
import { ApprovedOrder } from './order-approved';
import { PURCHASING, daysLate, receiveHref } from './order-cards';
import { ActivityList, OrderFrame, OrderedItems, WithdrawDialog, orderSubtitle, useApprover, useFailureToast } from './order-parts';
import { ReturnedOrder } from './order-returned';
import { Banner, Card, DangerTextAction, ItemsCard, Label, LinkAction, PhoneBar, PhoneError, PhoneLoading, PhoneScreen, PrimaryButton, SecondaryButton, WriteError, dayAndTime, dayLabel, plural, shortDay, timeHmm, useGoBack, withRole } from './phone-kit';

/** 28K: sent for approval, waiting. The Attendant may remind the Store Manager and may withdraw the order. */
function AwaitingOrder({ order }: { order: PurchaseFile }) {
  const router = useRouter();
  const approver = useApprover();
  const addToast = useWdsToastStore((s) => s.addToast);
  const { service } = useOrder(order.id);
  const [reminded, setReminded] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const remind = useAction(() => service.remindOrder(order.id), 'We could not send the reminder.');
  const failToast = useFailureToast();
  const withdraw = useAction(failToast('We could not withdraw this order', () => service.withdrawOrder(order.id)), 'We could not withdraw this order. Nothing was changed.');
  const who = withRole(approver);

  const onRemind = async (): Promise<void> => {
    const done = await remind.run();
    if (done) setReminded(timeHmm(new Date()));
  };
  // A reminder that was sent a moment ago comes back as a refusal that says when: show the same label as after a send.
  const tooSoon = remind.failure?.code === 'REMINDER_TOO_SOON' ? remind.failure.details : null;
  const lastReminded = typeof tooSoon === 'object' && tooSoon !== null && 'lastRemindedAt' in tooSoon && typeof tooSoon.lastRemindedAt === 'string' ? tooSoon.lastRemindedAt : undefined;
  const remindedAt = reminded ?? (lastReminded ? timeHmm(lastReminded) : null);

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
      subtitle={orderSubtitle(order)}
      bar={
        order.can.remind || order.can.withdraw ? (
          <PhoneBar>
            {remind.failure && remind.failure.code !== 'REMINDER_TOO_SOON' ? <WriteError>{remind.failure.message}</WriteError> : null}
            {order.can.remind ? (
              <SecondaryButton onClick={() => void onRemind()} disabled={remindedAt !== null || remind.saving} aria-busy={remind.saving}>
                {remindedAt ? `Reminded at ${remindedAt}` : remind.saving ? 'Sending…' : `Remind ${who}`}
              </SecondaryButton>
            ) : null}
            {order.can.withdraw ? <DangerTextAction onClick={() => setConfirm(true)}>Withdraw this order</DangerTextAction> : null}
          </PhoneBar>
        ) : undefined
      }
    >
      <Banner tone="warning" title={`Waiting for ${who} to approve`}>
        Sent for approval at {timeHmm(order.submittedAt)}. We will tell you as soon as it is decided.
      </Banner>
      <OrderedItems order={order} />
      {order.attendantNote ? (
        <section aria-labelledby="order-note" className="flex flex-col gap-1.5">
          <Label id="order-note">NOTE FOR {(approver?.name.split(' ')[0] ?? 'the Store Manager').toUpperCase()}, STORE MANAGER</Label>
          <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{order.attendantNote}</p>
        </section>
      ) : null}
      <ActivityList order={order} />
      <WithdrawDialog open={confirm} onOpenChange={setConfirm} reference={order.reference} busy={withdraw.saving} error={withdraw.failure?.message ?? null} onConfirm={() => void onWithdraw()} />
    </OrderFrame>
  );
}

/** 28J: sent to the supplier; overdue shows the red banner and the call buttons. */
function SentOrder({ order }: { order: PurchaseFile }) {
  const overdue = order.dueLabel === 'OVERDUE';
  const phone = order.supplier.phone?.replace(/[^\d+]/g, '') ?? '';
  const wa = (order.supplier.whatsapp ?? order.supplier.phone)?.replace(/[^\d]/g, '') ?? '';
  const by = order.collectedBy;
  return (
    <OrderFrame
      order={order}
      subtitle={orderSubtitle(order)}
      bar={
        order.can.receive ? (
          <PhoneBar>
            <PrimaryButton href={receiveHref(order.id)}>Receive delivery</PrimaryButton>
          </PhoneBar>
        ) : undefined
      }
    >
      {overdue ? (
        <Banner tone="error" title={`Overdue by ${plural(daysLate(order), 'day')}`}>
          Expected {dayLabel(order.expectedDate)}. Call {order.supplier.name} to find out where it is.
        </Banner>
      ) : order.dueLabel === 'DUE_TODAY' ? (
        <Banner tone="info" title="Delivery expected today">
          Receive it here when it arrives.
        </Banner>
      ) : (
        <Banner tone="info" title={`Delivery expected ${dayLabel(order.expectedDate)}`}>
          We will remind you on the day.
        </Banner>
      )}
      {overdue ? (
        <div className="flex gap-2.5">
          {phone ? (
            <a href={`tel:${phone}`} className="flex h-11 flex-1 items-center justify-center border border-wds-border-strong bg-white font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink outline-none focus-visible:shadow-wds-ring">
              Call supplier
            </a>
          ) : (
            <span aria-disabled="true" className="flex h-11 flex-1 items-center justify-center border border-wds-border bg-white font-wds-sans text-[13px] leading-4 text-wds-text-faint">
              No phone on file
            </span>
          )}
          {wa ? (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="flex h-11 flex-1 items-center justify-center gap-2 bg-[#25D366] font-wds-sans text-[13px] font-semibold leading-4 text-[#06351B] outline-none focus-visible:shadow-wds-ring">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06351B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 18.8L4 20z" />
              </svg>
              WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}
      {by ? (
        <section aria-labelledby="order-getting">
          <Card>
            <div className="border-b border-wds-border px-3.5 py-2.5">
              <Label id="order-getting">GETTING IT</Label>
            </div>
            <div className="flex items-center justify-between gap-3 px-3.5 py-3">
              <p className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{by.kind === 'SUPPLIER_DELIVERS' ? 'Supplier delivers' : by.label}</p>
              <p className="shrink-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Sent {dayAndTime(order.sentAt)}</p>
            </div>
          </Card>
        </section>
      ) : null}
      <OrderedItems order={order} />
      <ActivityList order={order} withDay />
    </OrderFrame>
  );
}

/** 28L (and the delivered and cancelled variants): the order is done. Delivered value only; never an invoice, a payment or a balance. */
function ClosedOrder({ order }: { order: PurchaseFile }) {
  const cancelled = order.status === 'CANCELLED';
  const closed = order.status === 'CLOSED';
  const closedAt = order.activity.length > 0 ? [...order.activity].sort((a, b) => b.at.localeCompare(a.at))[0]?.at : null;
  const subtitle = cancelled ? orderSubtitle(order, `raised ${shortDay(order.raisedAt)} · cancelled${order.cancelled ? ` ${shortDay(order.cancelled.at)}` : ''}`) : closed ? orderSubtitle(order, `raised ${shortDay(order.raisedAt)} · closed ${shortDay(closedAt)}`) : orderSubtitle(order, `delivered ${shortDay(order.delivery?.receivedAt)}`);
  const short = order.lines.filter((l) => l.result === 'SHORT' || l.result === 'NOT_SUPPLIED').length;
  const documents = order.documents.filter((d) => d.kind === 'LPO' || d.kind === 'DELIVERY_NOTE');
  const { service } = usePurchasing();
  const [docError, setDocError] = React.useState<string | null>(null);
  const openDocument = async (fileId: string | undefined): Promise<void> => {
    if (!fileId) return;
    setDocError(null);
    try {
      const link = await service.getFileUrl(fileId);
      window.open(link.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setDocError(e instanceof Error ? e.message : 'We could not open that document.');
    }
  };
  return (
    <OrderFrame order={order} subtitle={subtitle} tracker={cancelled ? 'none' : 'labelled'}>
      {cancelled ? (
        <Banner tone="error" title={order.cancelled?.reason === 'WITHDRAWN' ? 'Withdrawn' : 'Cancelled'}>
          {order.cancelled?.reason === 'WITHDRAWN' ? 'You took this order back before it was approved.' : order.cancelled?.note || 'This order was cancelled.'}
        </Banner>
      ) : closed ? (
        <Banner tone="success" title="Closed · paid in full">
          You received this on {dayLabel(order.delivery?.receivedAt)}.{short > 0 ? ` ${short === 1 ? 'One item was' : `${short} items were`} short.` : ''}
        </Banner>
      ) : (
        <Banner tone="info" title="Delivered">
          You received this on {dayLabel(order.delivery?.receivedAt)}.{short > 0 ? ` ${short === 1 ? 'One item was' : `${short} items were`} short.` : ''}
        </Banner>
      )}
      {order.deliveredTotal !== null && !cancelled ? (
        <div className="grid grid-cols-2 border border-wds-border bg-white">
          <div className="flex flex-col gap-1 border-r border-wds-border px-3.5 py-3">
            <Label small>ORDERED</Label>
            <p className="font-wds-mono text-[18px] leading-[22px] text-wds-text-ink">{kes(order.orderedTotal)}</p>
          </div>
          <div className="flex flex-col gap-1 px-3.5 py-3">
            <Label small>DELIVERED</Label>
            <p className="font-wds-mono text-[18px] leading-[22px] text-wds-text-ink">{kes(order.deliveredTotal)}</p>
          </div>
        </div>
      ) : null}
      <ItemsCard heading={`ITEMS · ${order.lines.length}`} labelId="order-items">
        {order.lines.map((l) => {
          const got = l.receivedQty;
          const isShort = got !== null && Number.parseFloat(got) < Number.parseFloat(l.orderedQty);
          return (
            <li key={l.id} className="flex items-center justify-between gap-3 border-b border-wds-border px-3.5 py-2.5 last:border-b-0">
              <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{l.itemName}</span>
              <span className={`shrink-0 font-wds-mono text-[12px] leading-4 ${isShort ? 'text-wds-error-fg' : 'text-wds-text-secondary'}`}>{got !== null ? `${qty(got)} of ${qty(l.orderedQty)} ${l.buyUnit}` : `${qty(l.orderedQty)} ${l.buyUnit}`}</span>
            </li>
          );
        })}
      </ItemsCard>
      {documents.length > 0 ? (
        <section aria-labelledby="order-docs">
          <Card>
            <div className="border-b border-wds-border px-3.5 py-2.5">
              <Label id="order-docs">YOUR DOCUMENTS</Label>
            </div>
            <ul>
              {documents.map((d) => (
                <li key={`${d.kind}-${d.title}`} className="flex items-center justify-between gap-3 border-b border-wds-border px-3.5 py-1 last:border-b-0">
                  <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{d.title}</span>
                  {d.kind === 'LPO' ? (
                    <LinkAction href={`/app/inventory/purchasing-print/${order.id}`} newTab>
                      Print
                    </LinkAction>
                  ) : d.fileRef ? (
                    <LinkAction onClick={() => void openDocument(d.fileRef?.id)}>View</LinkAction>
                  ) : null}
                </li>
              ))}
            </ul>
            {docError ? <WriteError>{docError}</WriteError> : null}
          </Card>
        </section>
      ) : null}
    </OrderFrame>
  );
}

/** One order on the phone: the right page for where it is (28D, 28H, 28J, 28K, 28L). */
export function OrderPhonePage({ orderId }: { orderId: string }) {
  const back = useGoBack(`${PURCHASING}/my-orders`);
  const { data: order, status, error, reload } = useOrder(orderId);

  if (!order) {
    return (
      <PhoneScreen header={<B2Header title="Order" subtitle=" " leading="back" onBack={back} place="HUB" />}>
        {status === 'error' ? <PhoneError className="m-5" onRetry={() => void reload()} message={error} /> : <PhoneLoading rows={3} card label="Loading this order" />}
      </PhoneScreen>
    );
  }
  switch (order.status) {
    case 'AWAITING_APPROVAL':
      return <AwaitingOrder order={order} />;
    case 'RETURNED':
    case 'DRAFT':
      return <ReturnedOrder order={order} />;
    case 'APPROVED':
      return <ApprovedOrder order={order} />;
    case 'SENT':
      return <SentOrder order={order} />;
    default:
      return <ClosedOrder order={order} />;
  }
}
