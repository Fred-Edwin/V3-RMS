'use client';

import * as React from 'react';

import { EmptyState, ErrorBlock, ListSkeleton, StateButton, useRemote } from '../../../_shared';
import { conductReads } from '../../_shared/services/conduct-services';
import type { DeskDetail } from '../../_shared/types/conduct-types';
import { showsAppealLayout } from '../lib/desk-model';
import { AppealPanel } from './appeal-panel';
import { StandardPanel } from './standard-panel';

/**
 * The right-hand panel: loads the chosen notice and shows the plain layout (S8) or, for an appeal the reader decides or reads as HR or the
 * Director, the appeal layout (S12). Another person's change shows as "This notice changed a moment ago" with the new values and a Refresh
 * (the panel compares `updatedAt` each time it reloads). A notice outside the reader's reach answers 404 and says so in plain words.
 */
export function NoticeDetailPanel({
  id,
  reloadToken,
  readsAll,
  onRecord,
  onDecide,
  onChange,
  onLoaded,
}: {
  id: string | null;
  reloadToken: number;
  readsAll: boolean;
  onRecord: (detail: DeskDetail) => void;
  onDecide: (detail: DeskDetail) => void;
  onChange: (detail: DeskDetail) => void;
  onLoaded?: (detail: DeskDetail) => void;
}) {
  const remote = useRemote(() => conductReads.detail(id ?? ''), `conduct-desk:${id}`, id !== null);
  const reload = remote.reload;
  // Ask again after the screen did something (reloadToken) and whenever the tab comes back into focus, so a change by someone else is noticed.
  const firstToken = React.useRef(reloadToken);
  React.useEffect(() => {
    if (firstToken.current !== reloadToken) reload();
  }, [reloadToken, reload]);
  React.useEffect(() => {
    const onFocus = (): void => reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);
  const now = React.useMemo(() => new Date(), [remote.data]); // eslint-disable-line react-hooks/exhaustive-deps -- "now" is read once per loaded notice, on purpose
  const detail = remote.data && remote.data.view === 'DESK' ? remote.data : null;
  const seen = React.useRef<string | null>(null);
  const [changed, setChanged] = React.useState(false);

  React.useEffect(() => {
    if (!detail) return;
    if (seen.current && seen.current !== detail.updatedAt) setChanged(true);
    seen.current = detail.updatedAt;
    onLoaded?.(detail);
  }, [detail, onLoaded]);
  React.useEffect(() => {
    seen.current = null;
    setChanged(false);
  }, [id]);

  if (id === null) return <EmptyState kind="nothingYet" title="Choose a notice" line="Pick a row to see what happened, who signed and when it ends." className="m-6" />;
  if (remote.status === 'loading' && !detail) return <div className="p-6"><ListSkeleton rows={4} columns={['fill']} label="Loading the notice" /></div>;
  if (remote.status === 'error' && !detail) {
    return remote.error.status === 404 ? (
      <EmptyState kind="nothingFound" title="We could not find that notice." line="It may be at another site, or no longer on this list." className="m-6" />
    ) : (
      <div className="p-6"><ErrorBlock title="The notice did not load" line="Nothing was changed." reference={remote.error.code} onRetry={remote.reload} /></div>
    );
  }
  if (!detail) return <EmptyState kind="nothingFound" title="This notice is not part of the desk view." line="Open it from your own notices." className="m-6" />;

  return (
    <div aria-live="polite">
      {changed ? (
        <div role="status" className="flex items-center justify-between gap-3 border-b border-wds-warning-border bg-wds-warning-bg px-[22px] py-2.5 font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">
          This notice changed a moment ago. The new values are shown.
          <StateButton onClick={() => setChanged(false)}>Got it</StateButton>
        </div>
      ) : null}
      {showsAppealLayout(detail, readsAll) ? (
        <AppealPanel detail={detail} onDecide={() => onDecide(detail)} />
      ) : (
        <StandardPanel detail={detail} now={now} onRecord={() => onRecord(detail)} onChange={() => onChange(detail)} />
      )}
    </div>
  );
}
