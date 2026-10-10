'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2Banner, B2Footer, B2Header, B2SecondaryButton } from '../../../_shared/components/block2-phone-parts';
import { BRANCH_DAY_BUTTONS, BRANCH_DAY_MESSAGES, BRANCH_DAY_STATES_COPY } from '../../_shared/lib/branch-day-copy';
import type { Home } from '../../_shared/types/branch-day-contract';
import { useDayHome } from '../hooks/use-phone-day';
import { dayText, plural, timeText } from '../lib/phone-format';
import { DAY_HOME } from '../lib/phone-routes';
import { BodyState, CardsSkeleton, PhoneTracker, type PhoneTrackerRow } from './phone-parts';

/** The four rows of B4, from the day's facts. A step that did not happen says so instead of showing a tick. */
export function sentRows(home: Home): PhoneTrackerRow[] {
  const { opening, delivery, count, closed } = home;
  return [
    opening.state === 'NOT_CHECKED'
      ? { key: 'opening', text: 'Opening not checked', state: 'todo' }
      : { key: 'opening', text: `Opening checked${opening.checkedAt ? ` · ${timeText(opening.checkedAt)}` : ''}`, state: 'done' },
    delivery.state === 'CONFIRMED'
      ? { key: 'delivery', text: `Delivery confirmed${delivery.confirmedAt ? ` · ${timeText(delivery.confirmedAt)}` : ''}`, state: 'done' }
      : delivery.state === 'WAITING'
        ? { key: 'delivery', text: 'Delivery not counted yet', state: 'todo' }
        : { key: 'delivery', text: 'No delivery today', state: 'done' },
    { key: 'count', text: `Evening count signed${count.signedAt ? ` · ${timeText(count.signedAt)}` : ''}`, state: closed.at ? 'done' : 'latest' },
    closed.at ? { key: 'close', text: `Day closed · ${timeText(closed.at)}`, state: 'latest' } : { key: 'close', text: 'Branch Manager closes the day', state: 'todo' },
  ];
}

/** Paper B4: the count is sent. The head's own slice only: nobody else's progress. */
export function CountSentScreen() {
  const router = useRouter();
  const { data, status, error, reload } = useDayHome();
  const copy = BRANCH_DAY_STATES_COPY.home;

  // Nothing was sent (someone opened this address): the Day tells where things stand.
  React.useEffect(() => {
    if (data && data.count.state !== 'COUNTED') router.replace(DAY_HOME);
  }, [data, router]);

  const signedAt = data?.count.signedAt ?? null;
  return (
    <PhoneColumn>
      <B2Header
        title="Count sent"
        subtitle={data ? `${data.department.name} · ${dayText(data.day.date)}${signedAt ? ` · ${timeText(signedAt)}` : ''}` : ''}
        mono
        leading="menu"
        place={data?.branch.name ?? ''}
      />
      {status === 'loading' || status === 'idle' ? (
        <CardsSkeleton text={copy.loading} />
      ) : status === 'error' || !data ? (
        <BodyState kind="error" text={error ?? copy.error} onRetry={() => void reload()} />
      ) : (
        <>
          <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-wds-surface p-5">
            <B2Banner tone="success" note title={`Counted and signed${signedAt ? ` at ${timeText(signedAt)}` : ''}`}>
              {plural(data.itemCount, 'item', 'items')} sent to the Branch Manager.
            </B2Banner>
            <PhoneTracker label="Where your day is" rows={sentRows(data)} />
            <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{BRANCH_DAY_MESSAGES.countSentNote}</p>
          </main>
          <B2Footer>
            <B2SecondaryButton onClick={() => router.push(DAY_HOME)}>{BRANCH_DAY_BUTTONS.backToDay}</B2SecondaryButton>
          </B2Footer>
        </>
      )}
    </PhoneColumn>
  );
}
