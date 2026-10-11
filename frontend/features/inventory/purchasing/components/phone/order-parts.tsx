'use client';

import * as React from 'react';

import { useAuthStore } from '@/store/authStore';
import { B2Header } from '../../../_shared/components/block2-phone-parts';
import { DecisionDialog } from '../../../_shared/components/decision-dialog';
import { useAttendantData } from '../../hooks/use-attendant';
import { kes, qty } from '../../lib/format';
import type { PurchaseFile } from '../../types';
import type { Approver } from '../../types/attendant';
import { CompactTracker } from '../compact-tracker';
import { PURCHASING } from './order-cards';
import { ItemRow, ItemsCard, Label, PhoneBar, PhoneScreen, PrimaryButton, SecondaryButton, dayLabel, plural, timeHHmm, useGoBack, withRole } from './phone-kit';

/** The Store Manager the Attendant's orders wait on, from the same call Home makes. */
export function useApprover(): Approver {
  const { data } = useAttendantData('attendant:approver', (s) => s.getAttendantHome(), 'We could not load Purchasing.');
  return data?.approver ?? null;
}

/** "LPO-0045 · KES 3,800" under the supplier's name. */
export const orderSubtitle = (o: PurchaseFile, extra?: string): string => [o.reference ?? 'Draft', extra ?? `KES ${kes(o.orderedTotal)}`].join(' · ');

/** The frame of every order page: dark header with the supplier, the tracker strip, a scrolling body and an optional sticky bar. */
export function OrderFrame({ order, subtitle, tracker = 'labelled', children, bar }: { order: PurchaseFile; subtitle: string; tracker?: 'labelled' | 'dots' | 'none'; children: React.ReactNode; bar?: React.ReactNode }) {
  const back = useGoBack(`${PURCHASING}/my-orders`);
  return (
    <PhoneScreen header={<B2Header title={order.supplier.name} subtitle={subtitle} leading="back" onBack={back} place="HUB" />} bar={bar}>
      {tracker === 'labelled' ? <CompactTracker tracker={order.tracker} strip /> : null}
      {tracker === 'dots' ? (
        <div className="border-b border-wds-border bg-white px-5 py-3">
          <CompactTracker tracker={order.tracker} variant="dots" />
        </div>
      ) : null}
      <div className="flex flex-col gap-3.5 px-5 py-4">{children}</div>
    </PhoneScreen>
  );
}

/** "ON THIS ORDER · 3 ITEMS": what was ordered, with the line total (the Attendant sees item prices, never an invoice). */
export function OrderedItems({ order, heading = 'ON THIS ORDER' }: { order: PurchaseFile; heading?: string }) {
  return (
    <ItemsCard heading={`${heading} · ${plural(order.lines.length, 'ITEM')}`} labelId="order-items">
      {order.lines.map((l) => (
        <ItemRow key={l.id} name={l.itemName} right={`${qty(l.orderedQty)} ${l.buyUnit} · ${kes(l.lineTotal)}`} />
      ))}
    </ItemsCard>
  );
}

/** ACTIVITY: newest first, "09:05 · You sent the order for approval". */
export function ActivityList({ order, withDay = false }: { order: PurchaseFile; withDay?: boolean }) {
  const me = useAuthStore((s) => s.user?.id);
  const rows = [...order.activity].sort((a, b) => b.at.localeCompare(a.at));
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="order-activity" className="flex flex-col gap-2">
      <Label id="order-activity">ACTIVITY</Label>
      <ul className="flex flex-col gap-1.5">
        {rows.map((a, i) => (
          <li key={`${a.at}-${i}`} className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            {withDay ? `${dayLabel(a.at)} ${timeHHmm(a.at)}` : timeHHmm(a.at)} · {a.actor.id === me ? 'You' : withRole(a.actor)} {a.what}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The "Withdraw LPO-0048? It will be cancelled." confirmation (Q-21): no PIN and no reason. */
export function WithdrawDialog({ open, onOpenChange, reference, busy, error, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; reference: string | null; busy: boolean; error: string | null; onConfirm: () => void }) {
  return (
    <DecisionDialog
      open={open}
      onOpenChange={onOpenChange}
      plain
      width={340}
      tone="warning"
      busy={busy}
      error={error}
      title={`Withdraw ${reference ?? 'this order'}?`}
      description="It will be cancelled. You can raise a new one from the restock list."
      actions={
        <div className="flex gap-2">
          <SecondaryButton size="card" onClick={() => onOpenChange(false)} disabled={busy} className="px-4">
            Keep
          </SecondaryButton>
          <PrimaryButton size="card" onClick={onConfirm} disabled={busy} aria-busy={busy} className="px-4">
            {busy ? 'Withdrawing…' : 'Withdraw'}
          </PrimaryButton>
        </div>
      }
    >
      <span className="sr-only">Nothing else is asked.</span>
    </DecisionDialog>
  );
}

export { PhoneBar };
