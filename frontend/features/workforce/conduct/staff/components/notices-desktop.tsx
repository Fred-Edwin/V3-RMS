'use client';

import * as React from 'react';

import { TablePager } from '@/components/ui2/data-table/table-pager';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';
import { cn } from '@/lib/cn';

import { EmptyState, FOCUS_RING, PageHeader, STATES_COPY, StatusText, WorkforceFrame, WorkforceKpiStrip, useRemote, type WorkforceKpiCell } from '../../../_shared';
import { LegacyRows } from '../../_shared/components/legacy-rows';
import { LoadingBlock, ProblemBlock } from '../../_shared/components/problem-block';
import { shortDay } from '../../_shared/lib/conduct-dates';
import { staffTone } from '../../_shared/lib/conduct-words';
import { conductReads } from '../../_shared/services/conduct-services';
import type { StaffList } from '../../_shared/types/conduct-types';
import { NoticePanel } from './notice-panel';

const INTRO = 'Every notice you have been given, kept for good. Open one to read it, sign it, appeal it or download it.';
const MUTED: ReadonlySet<string> = new Set(['ENDED', 'REPLACED', 'WITHDRAWN']);
const DETAILS: Record<string, (list: StaffList) => string> = {
  toSign: (l) => (l.counts.toSign > 0 ? 'waiting for your code' : 'nothing waiting for your code'),
  canAppeal: (l) => {
    const next = l.items.find((i) => i.canAppeal);
    return next ? `until ${shortDay(next.validUntil)}` : 'nothing to appeal';
  },
  ended: () => 'kept on your file',
};

/**
 * My notices on a desktop (frame 13.11): three figures, the notices as a table (notice, issued, status) with a numbered pager past a
 * page, and the chosen notice in full beside it. The first notice is chosen to begin with, one that waits for a signature first. The
 * phone keeps the card list and the notice page (`StaffListScreen`).
 */
export function NoticesDesktop({ selectedId = null }: { selectedId?: string | null }) {
  const list = useRemote<StaffList>(() => conductReads.mine(), 'conduct-mine');
  const [chosen, setChosen] = React.useState<string | null>(selectedId);
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(25);
  const data = list.data;
  const items = data?.items ?? [];
  const shown = items.slice((page - 1) * perPage, page * perPage);
  const openId = items.some((i) => i.id === chosen) ? chosen : (items[0]?.id ?? null);

  // Always the same three figures, in the order of frame 13.11 (the phone's band lets the server choose which three).
  const cells: WorkforceKpiCell[] = data
    ? [
        { key: 'toSign', label: 'TO SIGN', value: String(data.counts.toSign), detail: DETAILS.toSign?.(data) },
        { key: 'canAppeal', label: 'CAN APPEAL', value: String(data.counts.canAppeal), detail: DETAILS.canAppeal?.(data) },
        { key: 'ended', label: 'ENDED', value: String(data.counts.ended), detail: DETAILS.ended?.(data) },
      ]
    : [];
  return (
    <WorkforceFrame breadcrumb={{ section: 'My account', screen: 'My notices' }} phoneTitle="My notices" label="My notices">
      <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-5 px-6 py-7">
        <PageHeader size="lg" title="My notices" subtitle={INTRO} />
        {data && items.length > 0 && cells.length > 0 ? <WorkforceKpiStrip cells={cells} aria-label="Your notices at a glance" /> : null}
        {list.status === 'loading' ? <LoadingBlock label="Loading your notices" /> : null}
        {list.status === 'error' && !data ? <ProblemBlock error={list.error} what="your notices" onRetry={list.reload} /> : null}
        {data && items.length === 0 && data.legacy.length === 0 ? <EmptyState kind="nothingYet" title={STATES_COPY.conduct.nothingYet} /> : null}
        {data && items.length > 0 ? (
          <div className="grid grid-cols-[minmax(0,500px)_minmax(0,1fr)] items-start gap-5">
            <div className="flex flex-col gap-3">
              <div className="overflow-x-auto border border-wds-border bg-wds-surface">
                <Table look="workforce" aria-label="Your notices">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Notice</TableHead>
                      <TableHead className="w-[130px]">Issued</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((item) => (
                      <TableRow key={item.id} size="two-line" data-state={item.id === openId ? 'selected' : undefined} onClick={() => setChosen(item.id)} className={cn('cursor-pointer', MUTED.has(item.status) && 'text-wds-text-secondary')}>
                        <TableCell>
                          <button type="button" aria-current={item.id === openId ? 'true' : undefined} onClick={() => setChosen(item.id)} className={cn('flex flex-col gap-0.5 text-left', FOCUS_RING)}>
                            <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{item.title}</span>
                            <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{item.headline}</span>
                          </button>
                        </TableCell>
                        <TableCell className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{shortDay(item.issuedAt)}</TableCell>
                        <TableCell>
                          <StatusText tone={staffTone(item.status, item.canSign)}>{item.statusWord}</StatusText>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {items.length > 25 ? <TablePager page={page} perPage={perPage} shown={shown.length} total={items.length} onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} /> : null}
              <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
                Showing {shown.length} of {items.length} {items.length === 1 ? 'notice' : 'notices'}
              </p>
            </div>
            {openId ? <NoticePanel key={openId} id={openId} /> : null}
          </div>
        ) : null}
        {data && data.legacy.length > 0 ? <LegacyRows rows={data.legacy} /> : null}
      </div>
    </WorkforceFrame>
  );
}
