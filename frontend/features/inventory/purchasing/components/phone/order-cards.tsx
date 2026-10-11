'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { kes } from '../../lib/format';
import type { OrderRow } from '../../types';
import type { Approver, MyOrderRow } from '../../types/attendant';
import { CompactTracker } from '../compact-tracker';
import { Card, HIT, Pill, PrimaryButton, SecondaryButton, StatusLine, dayLabel, nameOnly, plural, timeHmm, withRole, type Tone } from './phone-kit';

export const PURCHASING = '/app/inventory/purchasing';
export const orderHref = (id: string): string => `${PURCHASING}/${id}`;
export const receiveHref = (id: string): string => `/app/inventory/receiving/${id}`;

/** The days an overdue order is late, from the server's `dueInDays` (negative when late). */
export const daysLate = (o: Pick<OrderRow, 'dueInDays'>): number => Math.max(1, Math.abs(o.dueInDays ?? 1));

/** The one status line under an order (Paper 28A "MY ORDERS" cards, and the order words in Search): a tone and the words. */
export function statusLine(o: OrderRow, approver: Approver): { tone: Tone; text: string } {
  switch (o.status) {
    case 'AWAITING_APPROVAL':
      return { tone: 'warning', text: `Waiting for ${withRole(approver)} · since ${timeHmm(o.submittedAt)}` };
    case 'RETURNED':
      return { tone: 'warning', text: 'Sent back · edit and resend' };
    case 'APPROVED':
      return { tone: 'success', text: 'Approved · ready to send' };
    case 'SENT':
      if (o.dueLabel === 'OVERDUE') return { tone: 'error', text: `Sent · overdue by ${plural(daysLate(o), 'day')} · call the supplier` };
      if (o.dueLabel === 'DUE_TODAY') return { tone: 'amber', text: `Delivery expected today${o.reference ? ` · ${o.reference}` : ''}` };
      return { tone: 'muted', text: o.expectedDate ? `Sent · delivery expected ${dayLabel(o.expectedDate)}` : 'Sent' };
    case 'DELIVERED':
    case 'INVOICED':
      return { tone: 'muted', text: 'Delivered' };
    case 'CLOSED':
      return { tone: 'success', text: 'Closed · paid in full' };
    case 'CANCELLED':
      return { tone: 'muted', text: o.cancelled?.reason === 'WITHDRAWN' ? 'Withdrawn' : 'Cancelled' };
    default:
      return { tone: 'muted', text: 'Draft' };
  }
}

/** "LPO-0047 · 3 items" and, on My orders, the total after it. */
export const refLine = (o: OrderRow, withTotal = false): string => [o.reference ?? 'Draft', plural(itemCount(o), 'item'), withTotal ? kes(o.orderedTotal) : null].filter(Boolean).join(' · ');

/** The row has an item summary string only ("4 items"); read the count out of it, else 0. */
export function itemCount(o: OrderRow): number {
  const n = Number.parseInt(o.itemSummary, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Opens the phone dialler for a supplier; with no number on file it opens the order, which says so. */
export function callHref(o: Pick<OrderRow, 'supplier' | 'id'>): string {
  const phone = o.supplier.phone?.replace(/[^\d+]/g, '');
  return phone ? `tel:${phone}` : orderHref(o.id);
}

// --- Home: "NEEDS YOU NOW" rows and "MY ORDERS" cards ----------------------------------------------------------------------------------

/** One row of the NEEDS YOU NOW card (Paper 28A): name, one status line, one button. */
export function NeedsYouRow({ order, approver }: { order: MyOrderRow; approver: Approver }) {
  const line = statusLine(order, approver);
  const action =
    order.need === 'SEND'
      ? { label: 'Send it', href: orderHref(order.id), primary: true }
      : order.need === 'RETURNED'
        ? { label: 'Edit and resend', href: orderHref(order.id), primary: true }
        : { label: 'Receive', href: receiveHref(order.id), primary: false };
  return (
    <li className="flex items-center justify-between gap-3 border-b border-wds-border px-3.5 py-3 last:border-b-0">
      <Link href={orderHref(order.id)} className="min-w-0 flex-1 rounded-wds-sm outline-none focus-visible:shadow-wds-ring">
        <p className="truncate font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{order.supplier.name}</p>
        <StatusLine tone={line.tone === 'amber' ? 'amber' : line.tone} plain={line.tone === 'amber' || line.tone === 'muted'} className="mt-1">
          {line.text}
        </StatusLine>
      </Link>
      {action.primary ? (
        <PrimaryButton size="inline" href={action.href} className={action.label.length > 8 ? 'w-auto px-3' : undefined}>
          {action.label}
        </PrimaryButton>
      ) : (
        <SecondaryButton size="inline" href={action.href}>
          {action.label}
        </SecondaryButton>
      )}
    </li>
  );
}

/** A card of "MY ORDERS": name and total, the reference, the unlabelled tracker, one status line. */
export function MyOrderCard({ order, approver }: { order: OrderRow; approver: Approver }) {
  const line = statusLine(order, approver);
  return (
    <li>
      <Link href={orderHref(order.id)} className="block rounded-[4px] outline-none focus-visible:shadow-wds-ring">
        <Card className="flex flex-col gap-3 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{order.supplier.name}</p>
              <p className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">{refLine(order)}</p>
            </div>
            <p className="shrink-0 font-wds-mono text-[14px] leading-[18px] text-wds-text-ink">{kes(order.orderedTotal)}</p>
          </div>
          <CompactTracker tracker={order.tracker} variant="dots" />
          <p className={cn('font-wds-sans text-[12px] font-medium leading-4', line.tone === 'warning' ? 'text-wds-warning-fg' : line.tone === 'error' ? 'text-wds-error-fg' : line.tone === 'success' ? 'text-wds-success-fg' : 'text-wds-text-secondary')}>{line.text}</p>
        </Card>
      </Link>
    </li>
  );
}

// --- My orders: the cards that need the Attendant -----------------------------------------------------------------------------------

/** A needs-you card on My orders (Paper 28F): head, tracker, and the buttons for what to do next. */
export function NeedsYouCard({ order }: { order: MyOrderRow }) {
  const overdue = order.need === 'RECEIVE' && order.dueLabel === 'OVERDUE';
  const pill =
    order.need === 'SEND'
      ? ({ tone: 'success', text: 'Ready to send' } as const)
      : order.need === 'RETURNED'
        ? ({ tone: 'warning', text: 'Sent back' } as const)
        : overdue
          ? ({ tone: 'error', text: `Overdue ${plural(daysLate(order), 'day')}` } as const)
          : ({ tone: 'info', text: 'Due today' } as const);
  const open = (
    <SecondaryButton size="card" href={orderHref(order.id)} className="w-[84px]" aria-label={`Open ${order.supplier.name}`}>
      Open
    </SecondaryButton>
  );
  return (
    <li>
      <Card error={overdue} className="flex flex-col gap-2.5 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={orderHref(order.id)} className={cn(HIT, 'block truncate rounded-wds-sm font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink outline-none focus-visible:shadow-wds-ring')}>
              {order.supplier.name}
            </Link>
            <p className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">{refLine(order, true)}</p>
          </div>
          <Pill tone={pill.tone}>{pill.text}</Pill>
        </div>
        <CompactTracker tracker={order.tracker} variant="dots" />
        <div className="flex gap-2">
          {order.need === 'SEND' ? (
            <PrimaryButton size="card" href={orderHref(order.id)} className="flex-1">
              Print or share, then send
            </PrimaryButton>
          ) : order.need === 'RETURNED' ? (
            <PrimaryButton size="card" href={orderHref(order.id)} className="flex-1">
              Edit and resend
            </PrimaryButton>
          ) : overdue ? (
            <SecondaryButton size="card" href={callHref(order)} className="flex-1">
              Call supplier
            </SecondaryButton>
          ) : (
            <PrimaryButton size="card" href={receiveHref(order.id)} className="flex-1">
              Receive delivery
            </PrimaryButton>
          )}
          {open}
        </div>
      </Card>
    </li>
  );
}

/** A waiting card: the Attendant has nothing to do ("Waiting for Joseph (Store Manager) · since 9:05"). */
export function WaitingCard({ order, approver }: { order: MyOrderRow; approver: Approver }) {
  const line = statusLine(order, approver);
  return (
    <li>
      <Link href={orderHref(order.id)} className="block rounded-[4px] outline-none focus-visible:shadow-wds-ring">
        <Card className="flex items-center justify-between gap-3 p-3.5">
          <div className="min-w-0">
            <p className="truncate font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{order.supplier.name}</p>
            <p className={cn('font-wds-sans text-[12px] leading-4', line.tone === 'warning' ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>{line.text}</p>
          </div>
          <p className="shrink-0 font-wds-mono text-[14px] leading-[18px] text-wds-text-ink">{kes(order.orderedTotal)}</p>
        </Card>
      </Link>
    </li>
  );
}
