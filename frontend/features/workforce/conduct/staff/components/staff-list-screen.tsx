'use client';

import * as React from 'react';

import { TablePager } from '@/components/ui2/data-table/table-pager';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';

import { EmptyState, PhoneScreen, STATES_COPY, useRemote } from '../../../_shared';
import { LoadingBlock, ProblemBlock } from '../../_shared/components/problem-block';
import { useLetterAction } from '../../_shared/hooks/use-letter-action';
import { useOnline } from '../../_shared/hooks/use-online';
import { staffTone } from '../../_shared/lib/conduct-words';
import { conductFiles, conductReads } from '../../_shared/services/conduct-services';
import type { StaffItem, StaffList } from '../../_shared/types/conduct-types';
import { LegacyRows } from '../../_shared/components/legacy-rows';
import { NoticeCard } from './notice-card';
import { NoticesDesktop } from './notices-desktop';
import { StatColumns } from './stat-columns';

const INTRO = 'Every notice you have been given, kept for good. Open one to read it, sign it, appeal it or download it.';
const MUTED: ReadonlySet<string> = new Set(['ENDED', 'REPLACED', 'WITHDRAWN']);

/**
 * The staff Conduct list (spec S1, S7; Paper 2ZFG-0 and 1HFB-0). The dark band gives the count, the person's name and three figures the
 * server chose for the state of the file. A notice waiting to be signed is on top. The download square fetches the latest signed letter.
 * Old HR records sit below, read only, in their own muted section. The pager appears only past 25 rows (no "Show older").
 */
export function StaffListScreen() {
  const { matches: desktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  if (!hydrated) return null;
  // A desktop has the list and the chosen notice side by side (frame 13.11).
  return desktop ? <NoticesDesktop /> : <PhoneNotices />;
}

function PhoneNotices() {
  const name = useAuthStore((s) => s.user?.name ?? '');
  const online = useOnline();
  const list = useRemote<StaffList>(() => conductReads.mine(), 'conduct-mine');
  const letter = useLetterAction();
  const [downloading, setDownloading] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(25);

  const download = React.useCallback(
    async (item: StaffItem) => {
      setDownloading(item.id);
      await letter.download(() => conductFiles.document(item.id, 'latest', false), 'The notice could not be downloaded. Try again.');
      setDownloading(null);
    },
    [letter]
  );

  const data = list.data;
  const count = data?.items.length ?? 0;
  const shown = data ? data.items.slice((page - 1) * perPage, page * perPage) : [];

  return (
    <PhoneScreen
      screen="Conduct"
      kicker="CONDUCT"
      back="/app/workforce"
      figure={data ? `${count} ${count === 1 ? 'notice' : 'notices'}` : ' '}
      figureSize="lg"
      subtitle={data ? `on your file${name ? ` · ${name}` : ''}` : undefined}
      aside={data && count > 0 ? <StatColumns columns={data.columns} /> : undefined}
      desktopTitle="Conduct"
    >
      {!online ? (
        <p role="status" className="m-0 border border-wds-warning-border bg-wds-warning-bg px-4 py-3 font-wds-sans text-[13px] leading-[19px] text-wds-warning-fg">
          No signal. Your notices need a connection to open.
        </p>
      ) : null}
      <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{INTRO}</p>
      {list.status === 'loading' ? <LoadingBlock label="Loading your notices" /> : null}
      {list.status === 'error' && !data ? <ProblemBlock error={list.error} what="your notices" onRetry={list.reload} /> : null}
      {data && count === 0 && data.legacy.length === 0 ? <EmptyState kind="nothingYet" title={STATES_COPY.conduct.nothingYet} /> : null}
      {letter.failed ? (
        <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
          {letter.failed}
        </p>
      ) : null}
      {data && count > 0 ? (
        <>
          <ul aria-label="Your notices" className="m-0 flex list-none flex-col gap-2 p-0">
            {shown.map((item) => (
              <NoticeCard key={item.id} item={item} tone={staffTone(item.status, item.canSign)} muted={MUTED.has(item.status)} onDownload={download} downloading={downloading === item.id} />
            ))}
          </ul>
          {count > 25 ? <TablePager page={page} perPage={perPage} shown={shown.length} total={count} onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} /> : null}
          <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-faint">
            {count} {count === 1 ? 'notice' : 'notices'} · the arrow downloads the signed notice. Nothing here is ever deleted: a notice that ends or is replaced stays on the list, marked as such.
          </p>
        </>
      ) : null}
      {data && data.legacy.length > 0 ? <LegacyRows rows={data.legacy} /> : null}
    </PhoneScreen>
  );
}
