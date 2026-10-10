'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2Footer, B2Header, B2PrimaryButton, B2SecondaryButton } from '../../../_shared/components/block2-phone-parts';
import { BRANCH_DAY_BUTTONS, BRANCH_DAY_STATES_COPY } from '../../_shared/lib/branch-day-copy';
import type { Home } from '../../_shared/types/branch-day-contract';
import { useDayHome } from '../hooks/use-phone-day';
import { dayLine, plural, timeText } from '../lib/phone-format';
import { DAY_COUNT, DAY_OPENING, DAY_SENT, DELIVERIES_HOME } from '../lib/phone-routes';
import { BodyState, CardsSkeleton, MonoLabel, StatusCard } from './phone-parts';

type CardState = 'done' | 'active' | 'muted';

/** The opening card: done once checked; the one to do in the morning; a muted line when the evening came and it never was. */
export function openingCard(home: Home): { state: CardState; title: string; sub: string } {
  const { opening, action } = home;
  if (opening.state !== 'NOT_CHECKED') {
    const first = opening.differences[0];
    const when = opening.checkedAt ? `${timeText(opening.checkedAt)} · ` : '';
    const what =
      opening.differences.length === 0
        ? 'same as last night'
        : opening.differences.length === 1 && first
          ? `${first.itemName} was ${Math.abs(Number(first.difference))} ${Number(first.difference) < 0 ? 'less' : 'more'}`
          : `${opening.differences.length} differences from last night`;
    return { state: 'done', title: 'Opening checked', sub: `${when}${what}` };
  }
  if (action === 'CHECK_OPENING') return { state: 'active', title: 'Check the opening', sub: 'Last night’s figures are ready. Check the shelves, then accept or recount.' };
  return { state: 'muted', title: 'Opening not checked', sub: 'The day ran on last night’s closing figure.' };
}

export function deliveryCard(home: Home): { state: CardState; title: string; sub: string; waiting: boolean } {
  const { delivery } = home;
  if (delivery.state === 'CONFIRMED') {
    const when = delivery.confirmedAt ? `${timeText(delivery.confirmedAt)} · ` : '';
    const gap = delivery.gapCount > 0 ? `${delivery.gapCount} short, held for the Store Manager` : 'nothing short';
    return { state: 'done', title: 'Delivery confirmed', sub: `${when}${gap}`, waiting: false };
  }
  if (delivery.state === 'WAITING') {
    const refs = delivery.dispatches.map((d) => d.reference).join(', ');
    return { state: 'active', title: 'Delivery not counted yet', sub: `${refs || 'A delivery'} left the store and is waiting for your count.`, waiting: true };
  }
  return { state: 'muted', title: 'No delivery today', sub: 'Nothing has left the store for your department.', waiting: false };
}

export function eveningCard(home: Home): { state: CardState; title: string; sub: string } {
  if (home.count.state === 'COUNTED') {
    const when = home.count.signedAt ? `${timeText(home.count.signedAt)} · ` : '';
    return { state: 'done', title: 'Evening count signed', sub: `${when}${plural(home.itemCount, 'item', 'items')} sent to the Branch Manager` };
  }
  const sub = `${plural(home.itemCount, 'item', 'items')}. Count what is on the shelves; nothing is shown to count against.`;
  return { state: home.action === 'COUNT' ? 'active' : 'muted', title: 'Evening count', sub };
}

/** Paper B0: where the head starts. Three steps of the day, one button. */
export function DayHomeScreen() {
  const router = useRouter();
  const { data, status, error, reload } = useDayHome();
  const orgName = useAuthStore((s) => s.user?.organizationName ?? '');
  const copy = BRANCH_DAY_STATES_COPY.home;
  const place = data?.branch.name ?? orgName;

  return (
    <PhoneColumn>
      <B2Header title="Day" subtitle={data ? dayLine(data.department.name, data.day.date, data.day.reference) : ''} mono leading="menu" place={place} />
      {status === 'loading' || status === 'idle' ? (
        <CardsSkeleton text={copy.loading} />
      ) : status === 'error' || !data ? (
        <BodyState kind="error" text={error ?? copy.error} onRetry={() => void reload()} />
      ) : (
        <HomeBody home={data} onGo={(href) => router.push(href)} />
      )}
    </PhoneColumn>
  );
}

function HomeBody({ home, onGo }: { home: Home; onGo: (href: string) => void }) {
  const cards = [openingCard(home), deliveryCard(home), eveningCard(home)];
  const delivery = cards[1] as ReturnType<typeof deliveryCard>;
  return (
    <>
      <main className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto bg-wds-surface p-5">
        <MonoLabel id="day-steps">{home.department.name} today</MonoLabel>
        <ul aria-labelledby="day-steps" className="flex flex-col gap-3.5">
          {cards.map((card, i) => (
            <StatusCard key={card.title} state={card.state} title={card.title} sub={card.sub}>
              {i === 1 && delivery.waiting ? (
                <Link href={DELIVERIES_HOME} className="-mb-3 mt-1 flex min-h-11 items-center font-wds-sans text-[13px] font-medium leading-[18px] text-[var(--wds-primary-btn-start)] underline underline-offset-2 outline-none transition-opacity duration-100 ease-out focus-visible:shadow-wds-ring active:opacity-60">
                  Count the delivery
                </Link>
              ) : null}
            </StatusCard>
          ))}
        </ul>
        <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
          {home.closed.at ? `The day closed at ${timeText(home.closed.at)}.` : 'The day closes once every department has counted.'}
        </p>
      </main>
      {home.action === 'NONE' ? (
        home.count.state === 'COUNTED' && !home.closed.at ? (
          <B2Footer>
            <B2SecondaryButton onClick={() => onGo(DAY_SENT)}>See your count</B2SecondaryButton>
          </B2Footer>
        ) : null
      ) : (
        <B2Footer>
          <B2PrimaryButton onClick={() => onGo(home.action === 'CHECK_OPENING' ? DAY_OPENING : DAY_COUNT)}>
            {home.action === 'CHECK_OPENING' ? BRANCH_DAY_BUTTONS.checkOpening : BRANCH_DAY_BUTTONS.countDepartment}
          </B2PrimaryButton>
        </B2Footer>
      )}
    </>
  );
}
