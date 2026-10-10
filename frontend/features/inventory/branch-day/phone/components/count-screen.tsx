'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2ErrorNote, B2Footer, B2Header, B2PrimaryButton } from '../../../_shared/components/block2-phone-parts';
import { BRANCH_DAY_BUTTONS, BRANCH_DAY_STATES_COPY } from '../../_shared/lib/branch-day-copy';
import { useCountDraft } from '../hooks/use-count-draft';
import { useCountView } from '../hooks/use-phone-day';
import { progressOf, stillToCount } from '../lib/count-logic';
import { dayLine, plural } from '../lib/phone-format';
import { DAY_COUNT_CHECK, DAY_HOME, DAY_SENT } from '../lib/phone-routes';
import { CountList } from './count-list';
import { BodyState, ProgressStrip, RowsSkeleton } from './phone-parts';

/** Paper B3: count my department, blind. Nothing is shown to count against. Saves as you type; "Check and sign" opens B3b. */
export function CountScreen() {
  const router = useRouter();
  const { data, status, error, reload } = useCountView();
  const orgName = useAuthStore((s) => s.user?.organizationName ?? '');
  const draft = useCountDraft(data);
  const copy = BRANCH_DAY_STATES_COPY.count;
  const [leaving, setLeaving] = React.useState(false);

  // Already sent (a second device, or the back button): the sent screen tells it.
  React.useEffect(() => {
    if (data?.state === 'COUNTED') router.replace(DAY_SENT);
  }, [data, router]);

  const items = React.useMemo(() => (data?.lines ?? []).map((l) => ({ id: l.itemId, name: l.itemName, unit: l.unit })), [data]);
  const progress = progressOf(items.map((i) => i.id), draft.typed);
  const note = stillToCount(progress.blank);

  const go = async (href: string): Promise<void> => {
    setLeaving(true);
    const saved = await draft.flush();
    setLeaving(false);
    if (saved) router.push(href);
  };

  return (
    <PhoneColumn>
      <B2Header
        title="Count your department"
        subtitle={data ? dayLine(data.department.name, data.day.date, plural(items.length, 'item', 'items')) : ''}
        mono
        leading="back"
        onBack={() => void go(DAY_HOME)}
        place={orgName}
      />
      {status === 'loading' || status === 'idle' ? (
        <RowsSkeleton text={copy.loading} />
      ) : status === 'error' || !data ? (
        <BodyState kind="error" text={error ?? 'Could not load your items. Try again.'} onRetry={() => void reload()} />
      ) : items.length === 0 ? (
        <BodyState kind="empty" text={copy.empty ?? ''} />
      ) : (
        <>
          <ProgressStrip filled={progress.filled} total={progress.total} percent={progress.percent} />
          {draft.ready ? <CountList items={items} typed={draft.typed} onType={draft.setFigure} mode="count" label="Items to count" /> : <RowsSkeleton text={copy.loading} />}
          <B2Footer note={note}>
            {draft.saveError ? (
              <B2ErrorNote>
                {draft.saveError}{' '}
                <button type="button" className="inline-flex min-h-11 items-center font-medium underline underline-offset-2 outline-none transition-opacity duration-100 ease-out focus-visible:shadow-wds-ring active:opacity-60" onClick={() => void draft.flush()}>
                  Try again
                </button>
              </B2ErrorNote>
            ) : null}
            <B2PrimaryButton disabled={progress.blank > 0 || leaving} onClick={() => void go(DAY_COUNT_CHECK)}>
              {BRANCH_DAY_BUTTONS.checkAndSign}
            </B2PrimaryButton>
          </B2Footer>
        </>
      )}
    </PhoneColumn>
  );
}
