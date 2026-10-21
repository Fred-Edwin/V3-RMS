'use client';

import * as React from 'react';

import { DataTable, type TableColumn, type TableCopy } from '@/components/ui2/data-table/data-table';
import { useAuthStore } from '@/store/authStore';

import { DialogButton, ListDetailLayout, PageHeader, StatusText, WorkforceFrame, WorkforceKpiStrip, nameAndRole, useRemote, type WorkforceKpiCell } from '../../../../_shared';
import { useOnline } from '../../../_shared/hooks/use-online';
import { statusLine, titleLine } from '../../../_shared/lib/leave-copy';
import { daySmall, rangeShort } from '../../../_shared/lib/leave-dates';
import { LEAVE_LOAD_FAILED } from '../../../_shared/lib/leave-ui';
import { leaveToast } from '../../../_shared/lib/leave-toast';
import { leaveReads } from '../../../_shared/services/leave-services';
import type { LeaveStatus, MyRow } from '../../../_shared/types/leave-types';
import { AskDrawer } from './ask-drawer';
import { OwnDetail } from './own-detail';

const COPY: TableCopy = {
  emptyTitle: 'You have not asked for leave this year.',
  emptyDescription: 'Use Ask for leave when you need days off.',
  filteredEmptyTitle: 'Nothing found',
  filteredEmptyDescription: 'Try another year, kind or status.',
  errorTitle: LEAVE_LOAD_FAILED.title,
  errorDescription: LEAVE_LOAD_FAILED.line,
};
const STATUSES: Record<string, LeaveStatus[]> = { WAITING: ['WAITING'], APPROVED: ['APPROVED'], DECLINED: ['DECLINED'], CANCELLED: ['CANCELLED'] };
const approverLine = (role: string | null): string => (role === 'MANAGER' || role === 'STORE_MANAGER' ? 'A manager’s own leave is approved by HR.' : 'Your leave is approved by the Director.');

/** My leave on a desktop (spec Step 13): KPIs, the list with search-less filters (the server filters year, kind and status), the request in full beside it. */
export function MyLeaveDesktop() {
  const user = useAuthStore((s) => s.user);
  const online = useOnline();
  const thisYear = new Date().getFullYear();
  const overview = useRemote(() => leaveReads.overview(), 'desktop-overview');
  const [refresh, setRefresh] = React.useState(0);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [asking, setAsking] = React.useState(false);
  const data = overview.data;

  const upcoming = useRemote(() => leaveReads.mine({ year: thisYear, status: ['APPROVED'], page: 1, rows: 100 }), `desktop-next:${refresh}`);
  const today = new Date().toISOString().slice(0, 10);
  const next = upcoming.data?.rows.filter((r) => r.end >= today).sort((a, b) => a.start.localeCompare(b.start))[0];

  const annual = data?.cards.find((c) => c.typeCode === 'ANNUAL') ?? data?.cards[0];
  const takenTotal = data?.cards.reduce((sum, c) => sum + c.taken, 0) ?? 0;
  const cells: WorkforceKpiCell[] = [
    { key: 'left', label: 'ANNUAL LEAVE LEFT', value: annual ? `${annual.left} d` : '–', detail: annual?.perYear ? `of ${annual.perYear} a year` : undefined },
    { key: 'taken', label: `TAKEN IN ${thisYear}`, value: `${takenTotal} d`, detail: data?.cards.filter((c) => c.taken > 0).map((c) => `${c.taken} ${c.label.toLowerCase().replace(' leave', '')}`).join(', ') || 'nothing yet' },
    { key: 'waiting', label: 'WAITING', value: String(data?.waiting?.count ?? 0), detail: data?.waiting?.oldest ? `with ${data.waiting.oldest.decidingRole ?? 'your decider'}` : 'nothing waiting' },
    { key: 'next', label: 'NEXT LEAVE', value: next ? daySmall(next.start) : 'None', detail: next ? `${rangeShort(next.start, next.end)}, ${next.days} d` : 'nothing booked' },
  ];

  const columns = React.useMemo<TableColumn<MyRow>[]>(
    () => [
      { id: 'type', header: 'TYPE', width: '200px', cell: (r) => <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{titleLine({ ...r, days: r.days, unpaidTailDays: r.unpaidTailDays }).split(' · ')[0]}</span> },
      { id: 'dates', header: 'DATES', cell: (r) => <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{rangeShort(r.start, r.end)}</span> },
      { id: 'days', header: 'DAYS', width: '70px', align: 'right', cell: (r) => <span className="font-wds-mono text-[13px] leading-4">{r.days}</span> },
      { id: 'status', header: 'STATUS', width: '210px', cell: (r) => { const s = statusLine(r); return <StatusText tone={s.tone === 'warning' ? 'warning' : s.tone === 'success' ? 'success' : s.tone === 'error' ? 'error' : 'muted'}>{s.text}</StatusText>; } },
    ],
    []
  );
  const filters = React.useMemo(
    () => [
      { kind: 'chips' as const, key: 'status', options: [{ value: '', label: 'All' }, { value: 'WAITING', label: 'Waiting' }, { value: 'APPROVED', label: 'Approved' }, { value: 'DECLINED', label: 'Declined' }, { value: 'CANCELLED', label: 'Cancelled' }] },
      { kind: 'dropdown' as const, key: 'year', label: 'Year', options: [thisYear, thisYear - 1, thisYear - 2].map((y) => ({ value: String(y), label: String(y) })) },
      { kind: 'dropdown' as const, key: 'type', label: 'Type', options: (data?.cards ?? []).map((c) => ({ value: c.typeCode, label: c.label })) },
    ],
    [thisYear, data?.cards]
  );

  const role = user?.role ?? null;
  return (
    <WorkforceFrame
      breadcrumb={{ section: 'Workforce', screen: 'My leave' }}
      phoneTitle="My leave"
      label="My leave"
      className="px-4 py-6 lg:px-8 lg:py-7"
      actions={<DialogButton kind="primary" size="lg" disabled={!online || !data || data.casual || data.chips.length === 0} onClick={() => setAsking(true)}>Ask for leave</DialogButton>}
    >
      <div className="mx-auto flex w-full max-w-[1204px] flex-col gap-5">
        <PageHeader size="lg" title="My leave" subtitle={`${user?.name ? `${nameAndRole(user.name, role)} · ` : ''}every request you have made, and what happened to each. ${approverLine(role)}`} />
        <WorkforceKpiStrip cells={cells} aria-label="My leave in numbers" />
        {data?.casual ? <p role="status" className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{data.message}</p> : null}
        <ListDetailLayout
          listWidth={640}
          showDetail={Boolean(openId)}
          list={
            <DataTable<MyRow>
              label="My leave requests"
              columns={columns}
              getRowId={(r) => r.id}
              filters={filters}
              copy={COPY}
              searchable={false}
              tableLook="workforce"
              rowSize="compact"
              className="border-0 bg-transparent"
              refreshToken={refresh}
              rowClassName={(r) => (r.id === openId ? 'bg-wds-warning-bg' : undefined)}
              onRowActivate={(r) => setOpenId(r.id)}
              fetchRows={async (q) => {
                const page = await leaveReads.mine({ year: Number(q.filters.year) || thisYear, status: q.filters.status ? STATUSES[q.filters.status] : undefined, type: q.filters.type, page: q.page, rows: q.perPage });
                return { rows: page.rows, total: page.total };
              }}
            />
          }
          detail={openId ? <OwnDetail key={openId} id={openId} onChanged={() => setRefresh((n) => n + 1)} /> : <p className="m-0 p-6 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Choose a request to see it in full.</p>}
        />
      </div>
      {data && !data.casual ? <AskDrawer open={asking} onOpenChange={setAsking} chips={data.chips} online={online} onSent={(id, sentTo) => { setAsking(false); leaveToast(`Sent to ${sentTo}.`); setRefresh((n) => n + 1); overview.reload(); setOpenId(id); }} /> : null}
    </WorkforceFrame>
  );
}
