'use client';

import * as React from 'react';
import Link from 'next/link';

import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { useAuthStore } from '@/store/authStore';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2Empty, B2Header, B2Tracker, Chip, ListSkeleton, RefLink, SectionLabel, type TrackerRow } from '../../../_shared/components/block2-phone-parts';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { couldNotLoad, deliveryChip, EMPTY_COPY } from '../../../_shared/lib/block2-words';
import { timeText } from '../../../requisitions/lib/time';
import type { DeliveryRow } from '../../_shared/types/deliveries-contract';
import { useDeliveriesList } from '../../hooks/use-deliveries';
import { deliveryCount, deliveryFile } from '../../lib/delivery-routes';

const today = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
const cycleWord = (c: DeliveryRow['cycle']): string => c.charAt(0) + c.slice(1).toLowerCase();

/** Deliveries waiting (Paper D7): the delivery to count, and what was counted earlier today. */
export function DeliveriesWaitingScreen() {
  const orgName = useAuthStore((s) => s.user?.organizationName ?? '');
  const [day] = React.useState(today);
  const waiting = useDeliveriesList({ tab: 'waiting' });
  const earlier = useDeliveriesList({ tab: 'past', from: day, to: day, pageSize: 25 });
  const rows = waiting.data?.rows ?? [];
  const department = rows[0]?.department.name ?? earlier.data?.rows[0]?.department.name ?? '';

  let body: React.ReactNode;
  if (waiting.status === 'error' && !waiting.data) {
    body = (
      <div role="alert">
        <MobileErrorState title="Could not load deliveries" description={couldNotLoad('deliveries')} onRetry={() => void waiting.reload()} />
      </div>
    );
  } else if (!waiting.data) {
    body = (
      <>
        <LoadingAnnouncer text="Loading deliveries" />
        <ListSkeleton rows={2} />
      </>
    );
  } else if (rows.length === 0) {
    body = <B2Empty title={EMPTY_COPY.deliveriesWaiting.title} description={EMPTY_COPY.deliveriesWaiting.line} />;
  } else {
    body = (
      <div className="flex flex-col gap-6">
        {rows.map((row) => (
          <WaitingCard key={row.id} row={row} showDepartment={new Set(rows.map((r) => r.department.id)).size > 1} />
        ))}
      </div>
    );
  }

  const earlierRows = earlier.data?.rows ?? [];
  return (
    <PhoneColumn>
      <B2Header title="Deliveries" subtitle={department ? `${department} · from the Central Store` : 'From the Central Store'} leading="menu" place={orgName} />
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto bg-wds-canvas p-5">
        {body}
        {earlierRows.length > 0 ? (
          <section aria-labelledby="earlier-today" className="flex flex-col gap-2.5">
            <SectionLabel id="earlier-today">Earlier today</SectionLabel>
            <ul className="flex flex-col gap-2.5">
              {earlierRows.map((row) => (
                <li key={row.id} className="flex flex-col gap-1.5 border border-wds-border bg-wds-surface px-4 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <RefLink reference={row.reference} href={deliveryFile(row.id)} />
                      <span className="font-wds-sans text-[13px] leading-[18px] text-[#1F5BAE] underline underline-offset-2">· {cycleWord(row.cycle)}</span>
                    </span>
                    <Chip spec={deliveryChip(row.stage, null)} className="py-[3px]" />
                  </div>
                  <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
                    {row.lineCount} {row.lineCount === 1 ? 'line' : 'lines'} · counted and signed{row.confirmedAt ? ` at ${timeText(row.confirmedAt)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </PhoneColumn>
  );
}

function WaitingCard({ row, showDepartment }: { row: DeliveryRow; showDepartment: boolean }) {
  const arrived = row.arrivedAt !== null || row.stage === 'WAITING_FOR_BRANCH';
  // Paper D7: "Arrived" is the primary orange (#B0610F); the hero card is 20/16, the title 24/30, the text 14/20.
  const status = row.stage === 'WAITING_FOR_BRANCH' ? { text: 'Waiting for the branch', color: 'text-wds-warning-fg', dot: 'bg-wds-warning-fg' } : arrived ? { text: 'Arrived', color: 'text-[var(--wds-primary-btn-start)]', dot: 'bg-[var(--wds-primary-btn-start)]' } : { text: 'On the way', color: 'text-wds-info-fg', dot: 'bg-wds-info-fg' };
  const where: TrackerRow[] = [
    { key: 'p', title: 'Packed and signed', line: timeText(row.signedAt), state: 'DONE' },
    arrived ? { key: 'w', title: 'On the way', line: `${timeText(row.signedAt)} · ${row.carrier.name}`, state: 'DONE' } : { key: 'w', title: 'On the way', line: `${timeText(row.signedAt)} · ${row.carrier.name}`, state: 'CURRENT' },
    arrived ? { key: 'c', title: 'Counted at the branch', line: 'Your turn', state: 'CURRENT' } : { key: 'c', title: 'Counted at the branch', line: 'Your turn', state: 'TODO' },
  ];
  return (
    <>
      <section aria-label={`Delivery ${row.reference}`} className="flex flex-col gap-4 border border-wds-border bg-wds-surface p-5">
        <div className="flex flex-col gap-1.5">
          <p className={`flex items-center gap-2 font-wds-sans text-[13px] font-medium leading-[18px] ${status.color}`}>
            <span className={`size-2 rounded-full ${status.dot}`} aria-hidden="true" />
            {status.text}
          </p>
          <h2 className="font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink">{arrived ? 'Your delivery is here' : 'Your delivery is on its way'}</h2>
          <p className="font-wds-sans text-[14px] leading-5 text-wds-text-secondary">
            {arrived ? 'Count what is in the boxes. Nothing is shown to copy, so count each item as you find it.' : 'Count it when it arrives. Nothing is shown to copy, so count each item as you find it.'}
          </p>
        </div>
        <div className="flex flex-col gap-2 border-y border-b-wds-border border-t-wds-text-ink py-3">
          <div className="flex items-center justify-between gap-2">
            <RefLink reference={row.reference} href={deliveryFile(row.id)} className="text-[14px] leading-[18px]" />
            <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
              {showDepartment ? `${row.department.name} · ` : ''}
              {row.lineCount} {row.lineCount === 1 ? 'line' : 'lines'}
            </span>
          </div>
          <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
            Left the Central Store {timeText(row.signedAt)} · {row.carrier.name}
          </p>
        </div>
        <Link
          href={deliveryCount(row.id)}
          className="flex h-12 w-full items-center justify-center rounded-[2px] bg-wds-gradient-primary font-wds-sans text-[15px] font-medium leading-5 text-wds-primary-fg outline-none transition-[filter,transform,box-shadow] duration-100 hover:brightness-110 focus-visible:shadow-wds-ring active:brightness-95 motion-safe:active:scale-[0.99]"
        >
          {row.countStarted ? 'Continue counting' : 'Count the delivery'}
        </Link>
      </section>
      <B2Tracker heading="Where it is" rows={where} />
    </>
  );
}
