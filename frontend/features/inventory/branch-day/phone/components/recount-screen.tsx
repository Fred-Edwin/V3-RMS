'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2ErrorNote, B2Footer, B2Header, B2PrimaryButton } from '../../../_shared/components/block2-phone-parts';
import { scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { BRANCH_DAY_ERROR_COPY, BRANCH_DAY_STATES_COPY } from '../../_shared/lib/branch-day-copy';
import { useOpeningView } from '../hooks/use-phone-day';
import { cleanFigure, isFigure, progressOf, stillToCount } from '../lib/count-logic';
import { dayLine, plural } from '../lib/phone-format';
import { DAY_HOME, DAY_OPENING, DAY_OPENING_SIGN } from '../lib/phone-routes';
import { readRecount, writeRecount } from '../lib/recount-session';
import { branchDayPhoneApi } from '../services/branch-day-phone-api';
import { CountList } from './count-list';
import { BodyState, RowsSkeleton } from './phone-parts';

/** Last night's figures as the boxes hold them: "8.000" reads "8". */
const lastNight = (lines: readonly { itemId: string; lastNightQty: string }[]): Record<string, string> =>
  Object.fromEntries(lines.map((l) => [l.itemId, String(Number(l.lastNightQty))]));

/**
 * The recount of the opening (not drawn in Paper; spec C5 and G28): the step 3 layout with the opening's words. It is blind (last
 * night's figures are not shown), and nothing is written until it is signed on the next step, so the figures wait in this tab.
 */
export function RecountScreen() {
  const router = useRouter();
  const { data, status, error, reload } = useOpeningView();
  const orgName = useAuthStore((s) => s.user?.organizationName ?? '');
  const copy = BRANCH_DAY_STATES_COPY.opening;
  const [typed, setTyped] = React.useState<Record<string, string>>({});
  const [loaded, setLoaded] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!data) return;
    if (data.check.state !== 'NOT_CHECKED') {
      router.replace(DAY_HOME);
      return;
    }
    // Last night's figures are filled in; a recount already started in this tab keeps what was changed.
    setTyped(readRecount()?.figures ?? lastNight(data.lines));
    setLoaded(true);
  }, [data, router]);

  const was = React.useMemo(() => lastNight(data?.lines ?? []), [data]);
  const items = React.useMemo(
    () => (data?.lines ?? []).map((l) => ({ id: l.itemId, name: l.itemName, unit: l.unit, section: l.categoryPath[0] ?? 'No category', note: typed[l.itemId] !== undefined && typed[l.itemId] !== was[l.itemId] ? `${l.unit} · was ${was[l.itemId]} last night` : undefined })),
    [data, typed, was],
  );
  const changedIds = React.useMemo(() => new Set(items.filter((i) => typed[i.id] !== undefined && typed[i.id] !== was[i.id]).map((i) => i.id)), [items, typed, was]);
  const progress = progressOf(items.map((i) => i.id), typed);
  const note = stillToCount(progress.blank);

  const setFigure = (id: string, raw: string): void => {
    const next = { ...typed, [id]: cleanFigure(raw) };
    setTyped(next);
    writeRecount({ figures: next, preview: null });
  };

  const check = (): void => {
    if (checking || progress.blank > 0) return;
    setChecking(true);
    setProblem(null);
    const lines = items.filter((i) => isFigure(typed[i.id])).map((i) => ({ itemId: i.id, countedQty: String(typed[i.id]) }));
    branchDayPhoneApi
      .recountPreview({ lines })
      .then((preview) => {
        writeRecount({ figures: typed, preview });
        router.push(DAY_OPENING_SIGN);
      })
      .catch((err: unknown) => {
        setProblem(scwErrorMessage(err, BRANCH_DAY_ERROR_COPY, 'Could not check the difference. Your figures are kept on this screen. Try again.'));
        setChecking(false);
      });
  };

  return (
    <PhoneColumn>
      <B2Header
        title="Recount the opening"
        subtitle={data ? dayLine(data.department.name, data.day.date, plural(items.length, 'item', 'items')) : ''}
        mono
        leading="back"
        onBack={() => router.push(DAY_OPENING)}
        place={orgName}
      />
      {status === 'loading' || status === 'idle' ? (
        <RowsSkeleton text={copy.loading} />
      ) : status === 'error' || !data ? (
        <BodyState kind="error" text={error ?? copy.error} onRetry={() => void reload()} />
      ) : items.length === 0 ? (
        <BodyState kind="empty" text={copy.empty ?? ''} />
      ) : (
        <>
          <div className="flex shrink-0 flex-col gap-1 border-b border-wds-text-ink bg-wds-surface px-5 pb-3 pt-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">Fix what is wrong</p>
              <p aria-live="polite" className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
                {changedIds.size === 0 ? 'Nothing changed' : `${changedIds.size} changed`}
              </p>
            </div>
            <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Last night’s figures are filled in. Change any that are not what is on the shelf.</p>
          </div>
          {loaded ? <CountList items={items} typed={typed} onType={setFigure} mode="review" changedIds={changedIds} label="Items to recount" /> : <RowsSkeleton text={copy.loading} />}
          <B2Footer note={note}>
            {problem ? <B2ErrorNote>{problem}</B2ErrorNote> : null}
            <B2PrimaryButton disabled={progress.blank > 0 || checking} onClick={check}>
              {checking ? 'Checking' : 'Check the difference'}
            </B2PrimaryButton>
          </B2Footer>
        </>
      )}
    </PhoneColumn>
  );
}
