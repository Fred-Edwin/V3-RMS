'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2Banner, B2Footer, B2Header, B2SecondaryButton } from '../../../_shared/components/block2-phone-parts';
import { BRANCH_DAY_BUTTONS, BRANCH_DAY_MESSAGES, BRANCH_DAY_STATES_COPY, openingDifferenceLine } from '../../_shared/lib/branch-day-copy';
import { useOpeningView } from '../hooks/use-phone-day';
import { figureText, dayText, signedText, timeText } from '../lib/phone-format';
import { DAY_OPENING } from '../lib/phone-routes';
import { BodyState, MonoLabel, RingMarker, RowsSkeleton } from './phone-parts';

/** Paper B2b: the opening is recorded. The count stands; any difference is on record with the head's name against it. */
export function OpeningRecordedScreen() {
  const router = useRouter();
  const { data, status, error, reload } = useOpeningView();
  const orgName = useAuthStore((s) => s.user?.organizationName ?? '');
  const copy = BRANCH_DAY_STATES_COPY.opening;

  // Nothing was recorded (someone opened this address): the opening screen is where it starts.
  React.useEffect(() => {
    if (data && data.check.state === 'NOT_CHECKED') router.replace(DAY_OPENING);
  }, [data, router]);

  const at = data?.check.checkedAt ?? null;
  const differences = data?.check.differences ?? [];
  const matches = data ? data.itemCount - differences.length : 0;

  return (
    <PhoneColumn>
      <B2Header
        title="Opening recorded"
        subtitle={data ? `${data.department.name} · ${dayText(data.day.date)}${at ? ` · ${timeText(at)}` : ''}` : ''}
        mono
        leading="menu"
        place={orgName}
      />
      {status === 'loading' || status === 'idle' ? (
        <RowsSkeleton rows={4} text={copy.loading} />
      ) : status === 'error' || !data ? (
        <BodyState kind="error" text={error ?? copy.error} onRetry={() => void reload()} />
      ) : (
        <>
          <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-wds-surface p-5">
            <B2Banner tone="success" note title={`Counted and signed${at ? ` at ${timeText(at)}` : ''}`}>
              The {data.department.name} day starts from your count.
            </B2Banner>
            <section aria-label="What you recorded" className="border border-wds-border-strong">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">Items that match last night</span>
                <span className="font-wds-mono text-[14px] leading-[18px] text-wds-text-ink">{matches}</span>
              </div>
              {differences.map((d) => (
                <div key={d.itemId} className="flex items-center justify-between gap-3 border-t border-wds-warning-border bg-wds-warning-bg px-4 py-3">
                  <div className="flex min-w-0 flex-col gap-px">
                    <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{d.itemName}</span>
                    <span className="font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">{openingDifferenceLine({ ...d, lastNightQty: figureText(d.lastNightQty), countedQty: figureText(d.countedQty) })}</span>
                  </div>
                  <span className="shrink-0 font-wds-mono text-[14px] font-semibold leading-[18px] text-wds-warning-fg">{signedText(d.difference)}</span>
                </div>
              ))}
            </section>
            {differences.length > 0 ? <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{BRANCH_DAY_MESSAGES.openingManagerSees}</p> : null}
            <section aria-labelledby="next-label" className="flex flex-col gap-2.5 pt-1">
              <MonoLabel id="next-label">Next</MonoLabel>
              <p className="flex items-center gap-2.5 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
                <RingMarker />
                This evening: count your department
              </p>
            </section>
          </main>
          <B2Footer>
            <B2SecondaryButton onClick={() => router.push('/app/day')}>{BRANCH_DAY_BUTTONS.backToDay}</B2SecondaryButton>
          </B2Footer>
        </>
      )}
    </PhoneColumn>
  );
}
