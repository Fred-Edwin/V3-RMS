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
import { BodyState, ProgressStrip, RowsSkeleton } from './phone-parts';

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
    setTyped(readRecount()?.figures ?? {});
    setLoaded(true);
  }, [data, router]);

  const items = React.useMemo(() => (data?.lines ?? []).map((l) => ({ id: l.itemId, name: l.itemName, unit: l.unit })), [data]);
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
          <ProgressStrip filled={progress.filled} total={progress.total} percent={progress.percent} />
          {loaded ? <CountList items={items} typed={typed} onType={setFigure} mode="count" label="Items to recount" /> : <RowsSkeleton text={copy.loading} />}
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
