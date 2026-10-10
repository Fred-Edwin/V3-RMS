'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2ErrorNote, B2Footer, B2Header, B2PrimaryButton } from '../../../_shared/components/block2-phone-parts';
import { BRANCH_DAY_BUTTONS, BRANCH_DAY_STATES_COPY } from '../../_shared/lib/branch-day-copy';
import { useCountDraft } from '../hooks/use-count-draft';
import { useCountView } from '../hooks/use-phone-day';
import { progressOf } from '../lib/count-logic';
import { plural } from '../lib/phone-format';
import { DAY_COUNT_CHECK, DAY_SENT } from '../lib/phone-routes';
import { CountList } from './count-list';
import { BodyState, RowsSkeleton } from './phone-parts';

/**
 * Paper B3c: every figure, not sent yet. The same list as B3 without the progress strip. A figure can still be changed until it is
 * sent (contract §0.7); one changed since this screen opened carries a small amber ring (spec gap G4).
 */
export function CountReviewScreen() {
  const router = useRouter();
  const { data, status, error, reload } = useCountView();
  const orgName = useAuthStore((s) => s.user?.organizationName ?? '');
  const draft = useCountDraft(data);
  const copy = BRANCH_DAY_STATES_COPY.count;
  const [leaving, setLeaving] = React.useState(false);
  const opened = React.useRef<Record<string, string> | null>(null);

  React.useEffect(() => {
    if (draft.ready && opened.current === null) opened.current = { ...draft.savedRef.current };
  }, [draft.ready, draft.savedRef]);
  React.useEffect(() => {
    if (data?.state === 'COUNTED') router.replace(DAY_SENT);
  }, [data, router]);

  const items = React.useMemo(() => (data?.lines ?? []).map((l) => ({ id: l.itemId, name: l.itemName, unit: l.unit })), [data]);
  const changed = React.useMemo(() => {
    const base = opened.current;
    return new Set(base ? items.filter((i) => (draft.typed[i.id] ?? '') !== (base[i.id] ?? '')).map((i) => i.id) : []);
  }, [items, draft.typed]);
  const progress = progressOf(items.map((i) => i.id), draft.typed);

  const back = async (): Promise<void> => {
    setLeaving(true);
    const saved = await draft.flush();
    setLeaving(false);
    if (saved) router.push(DAY_COUNT_CHECK);
  };

  return (
    <PhoneColumn>
      <B2Header
        title="Every figure"
        subtitle={data ? `${data.department.name} · ${plural(items.length, 'item', 'items')} · not sent yet` : ''}
        mono
        leading="back"
        onBack={() => void back()}
        place={orgName}
      />
      {status === 'loading' || status === 'idle' ? (
        <RowsSkeleton text={copy.loading} />
      ) : status === 'error' || !data ? (
        <BodyState kind="error" text={error ?? 'Could not load your items. Try again.'} onRetry={() => void reload()} />
      ) : (
        <>
          {draft.ready ? <CountList items={items} typed={draft.typed} onType={draft.setFigure} mode="review" changedIds={changed} label="Every figure" /> : <RowsSkeleton text={copy.loading} />}
          <B2Footer note={progress.blank > 0 ? `${plural(progress.blank, 'item', 'items')} left blank. Fill every box to go on.` : null}>
            {draft.saveError ? (
              <B2ErrorNote>
                {draft.saveError}{' '}
                <button type="button" className="inline-flex min-h-11 items-center font-medium underline underline-offset-2 outline-none transition-opacity duration-100 ease-out focus-visible:shadow-wds-ring active:opacity-60" onClick={() => void draft.flush()}>
                  Try again
                </button>
              </B2ErrorNote>
            ) : null}
            <B2PrimaryButton disabled={progress.blank > 0 || leaving} onClick={() => void back()}>
              {BRANCH_DAY_BUTTONS.backToCheckAndSign}
            </B2PrimaryButton>
          </B2Footer>
        </>
      )}
    </PhoneColumn>
  );
}
