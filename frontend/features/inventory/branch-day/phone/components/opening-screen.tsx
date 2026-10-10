'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2ErrorNote, B2Footer, B2Header, B2PrimaryButton, B2SecondaryButton } from '../../../_shared/components/block2-phone-parts';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { scwErrorCode, scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { BRANCH_DAY_BUTTONS, BRANCH_DAY_ERROR_COPY, BRANCH_DAY_STATES_COPY } from '../../_shared/lib/branch-day-copy';
import { useOpeningView } from '../hooks/use-phone-day';
import { branchDayPhoneApi } from '../services/branch-day-phone-api';
import { clearRecount } from '../lib/recount-session';
import { dayText, figureText, plural, timeText, weekdayText } from '../lib/phone-format';
import { DAY_HOME, DAY_RECOUNT } from '../lib/phone-routes';
import { BodyState, CountRow, LastNightFigure, RowsSkeleton } from './phone-parts';

/** Paper B1: last night's signed figures. "Yes, same as last night" accepts with one tap and no PIN; "No, I'll recount" starts the blind recount. */
export function OpeningScreen() {
  const router = useRouter();
  const { data, status, error, reload } = useOpeningView();
  const orgName = useAuthStore((s) => s.user?.organizationName ?? '');
  const addToast = useWdsToastStore((s) => s.addToast);
  const { key } = useIdempotencyKey();
  const [saving, setSaving] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const copy = BRANCH_DAY_STATES_COPY.opening;

  // Already checked (a second device, or the back button): the Day card tells the story.
  React.useEffect(() => {
    if (data && data.check.state !== 'NOT_CHECKED') router.replace(DAY_HOME);
  }, [data, router]);

  const accept = (): void => {
    if (saving) return;
    setSaving(true);
    setProblem(null);
    branchDayPhoneApi
      .acceptOpening({ idempotencyKey: key() })
      .then(() => {
        clearRecount();
        addToast({ variant: 'success', title: 'Opening checked. The day starts from last night’s figures.' });
        router.push(DAY_HOME);
      })
      .catch((err: unknown) => {
        if (scwErrorCode(err) === 'OPENING_ALREADY_CHECKED') router.replace(DAY_HOME);
        else setProblem(scwErrorMessage(err, BRANCH_DAY_ERROR_COPY, 'Could not record the opening. Nothing was written. Try again.'));
        setSaving(false);
      });
  };

  const place = orgName;
  const ready = status === 'ready' && data && data.check.state === 'NOT_CHECKED';
  return (
    <PhoneColumn>
      <B2Header
        title="Opening count"
        subtitle={data ? `${data.department.name} · ${dayText(data.day.date)} · ${plural(data.itemCount, 'item', 'items')}` : ''}
        mono
        leading="back"
        onBack={() => router.push(DAY_HOME)}
        place={place}
      />
      {status === 'loading' || status === 'idle' ? (
        <RowsSkeleton text={copy.loading} />
      ) : status === 'error' || !data ? (
        <BodyState kind="error" text={error ?? copy.error} onRetry={() => void reload()} />
      ) : data.lines.length === 0 ? (
        <BodyState kind="empty" text={copy.empty ?? ''} />
      ) : (
        <>
          <main className="flex min-h-0 flex-1 flex-col">
          <section className="flex shrink-0 flex-col gap-1 border-b border-wds-text-ink bg-wds-surface px-5 pb-3.5 pt-4">
            <h2 className="font-wds-sans text-[17px] font-semibold leading-[22px] text-wds-text-ink">Same as last night?</h2>
            <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
              {data.lastCloseAt
                ? `These are the figures signed when the ${data.department.name} day closed on ${weekdayText(data.lastCloseAt)} at ${timeText(data.lastCloseAt)}. Check the shelves, then accept or recount.`
                : `These are the figures in stock for the ${data.department.name} day. Check the shelves, then accept or recount.`}
            </p>
          </section>
          <ul aria-label="Last night’s figures" className="min-h-0 flex-1 overflow-y-auto bg-wds-surface">
            {data.lines.map((line) => (
              <li key={line.itemId}>
                <CountRow name={line.itemName} hint={line.unit}>
                  <LastNightFigure value={figureText(line.lastNightQty)} />
                </CountRow>
              </li>
            ))}
          </ul>
          </main>
        </>
      )}
      {ready ? (
        <B2Footer>
          {problem ? <B2ErrorNote>{problem}</B2ErrorNote> : null}
          <B2PrimaryButton onClick={accept} disabled={saving}>
            {saving ? 'Recording' : BRANCH_DAY_BUTTONS.sameAsLastNight}
          </B2PrimaryButton>
          <B2SecondaryButton className="h-11" onClick={() => router.push(DAY_RECOUNT)} disabled={saving}>
            {BRANCH_DAY_BUTTONS.recount}
          </B2SecondaryButton>
        </B2Footer>
      ) : null}
    </PhoneColumn>
  );
}
