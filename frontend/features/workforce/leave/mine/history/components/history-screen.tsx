'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { TablePager } from '@/components/ui2/data-table/table-pager';
import { useAuthStore } from '@/store/authStore';

import { EmptyState, ErrorBlock, ListSkeleton, PeriodStepper, PhoneScreen, UnderlineTabs, useRemote } from '../../../../_shared';
import { LEAVE_LOADING } from '../../../_shared/lib/leave-ui';
import { MY_LEAVE, MY_LEAVE_REQUEST } from '../../../_shared/lib/leave-routes';
import { leaveReads } from '../../../_shared/services/leave-services';
import type { LeaveStatus, MyRow } from '../../../_shared/types/leave-types';
import { countsOf } from '../lib/history-counts';
import { HistoryRow } from './history-row';

type Tab = 'all' | 'waiting' | 'approved' | 'declined';
const STATUS: Record<Tab, LeaveStatus[] | undefined> = { all: undefined, waiting: ['WAITING'], approved: ['APPROVED'], declined: ['DECLINED'] };
const ROWS = 25;

const stat = (label: string, value: number, accent?: string) => (
  <div key={label} className="flex flex-1 flex-col gap-0.5">
    <span className="font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-neutral-300">{label}</span>
    <span className="font-wds-mono text-[18px] leading-6 text-white" style={accent ? { color: accent } : undefined}>{value}</span>
  </div>
);

/** History (spec Step 3): the year's requests, a year stepper, tabs with counts and a numbered pager. */
export function HistoryScreen() {
  const router = useRouter();
  const name = useAuthStore((s) => s.user?.name ?? '');
  const thisYear = new Date().getFullYear();
  const [year, setYear] = React.useState(thisYear);
  const [tab, setTab] = React.useState<Tab>('all');
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState(ROWS);

  // One call for the whole year gives the counts and the three header figures; the list itself pages on the server.
  const everything = useRemote(() => leaveReads.mine({ year, page: 1, rows: 100 }), `history-all:${year}`);
  const list = useRemote(() => leaveReads.mine({ year, status: STATUS[tab], page, rows }), `history:${year}:${tab}:${page}:${rows}`);
  const counts = countsOf(everything.data?.rows ?? []);

  const pick = (next: Tab): void => { setTab(next); setPage(1); };
  const changeYear = (delta: number): void => { setYear((y) => y + delta); setPage(1); };

  const tabs = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'waiting', label: 'Waiting', count: counts.waiting },
    { value: 'approved', label: 'Approved', count: counts.approved },
    { value: 'declined', label: 'Declined', count: counts.declined },
  ];

  let body: React.ReactNode;
  if (list.status === 'loading') body = <ListSkeleton rows={5} columns={[24, 'fill', 28]} label={LEAVE_LOADING} />;
  else if (!list.data) body = <ErrorBlock title="Your history did not load" line="Nothing was changed. Check your connection and try again." onRetry={list.reload} />;
  else if (list.data.total === 0) {
    body = tab === 'all'
      ? <EmptyState kind="nothingYet" title={`You have not asked for leave in ${year}.`} action={year === thisYear ? { label: 'Ask for leave', onClick: () => router.push(MY_LEAVE_REQUEST) } : undefined} />
      : <EmptyState kind="nothingFound" title="Nothing waiting." line={tab === 'waiting' ? undefined : 'Nothing in this tab.'} />;
  } else {
    const shown: MyRow[] = list.data.rows;
    body = (
      <div className="border border-wds-border bg-wds-surface">
        <ul className="m-0 list-none p-0" aria-label={`Leave requests, ${tab}`}>
          {shown.map((row) => <HistoryRow key={row.id} row={row} />)}
        </ul>
        <TablePager page={page} perPage={rows} shown={shown.length} total={list.data.total} onPageChange={setPage} onPerPageChange={(n) => { setRows(n); setPage(1); }} />
      </div>
    );
  }

  return (
    <PhoneScreen
      screen="My leave"
      kicker={`MY LEAVE · HISTORY`}
      back={MY_LEAVE}
      figureSize="lg"
      figure={`${counts.all} ${counts.all === 1 ? 'request' : 'requests'}`}
      subtitle={`in ${year}${name ? ` · ${name}` : ''}`}
      desktopTitle="History"
      aside={<div className="flex w-full gap-3 border-t border-[#5B3417] pt-3">{stat('TAKEN', counts.takenDays)}{stat('WAITING', counts.waiting, '#EFCF9E')}{stat('DECLINED', counts.declined)}</div>}
    >
      <PeriodStepper label={String(year)} previousLabel="Previous year" nextLabel="Next year" onPrevious={() => changeYear(-1)} onNext={() => changeYear(1)} nextDisabled={year >= thisYear} />
      <UnderlineTabs label="Show requests" items={tabs} value={tab} onChange={(v) => pick(v as Tab)} />
      {body}
    </PhoneScreen>
  );
}
