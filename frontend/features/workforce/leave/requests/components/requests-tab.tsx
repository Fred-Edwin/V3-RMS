'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { DataTable, type TableColumn, type TableCopy } from '@/components/ui2/data-table/data-table';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';

import { ListDetailLayout, StatusText, WorkforceKpiStrip, type WorkforceKpiCell } from '../../../_shared';
import { rangeShort } from '../../_shared/lib/leave-dates';
import { LEAVE_LOAD_FAILED } from '../../_shared/lib/leave-ui';
import { leaveReads } from '../../_shared/services/leave-services';
import type { RequestRow, RequestsKpis } from '../../_shared/types/leave-types';
import { RequestDetail } from './request-detail';

const COPY: TableCopy = {
  emptyTitle: 'No leave requests this month.',
  emptyDescription: 'When someone asks for leave it appears here.',
  filteredEmptyTitle: 'Nothing found.',
  filteredEmptyDescription: 'Try another name, or choose All recent.',
  errorTitle: LEAVE_LOAD_FAILED.title,
  errorDescription: LEAVE_LOAD_FAILED.line,
};

const ROTA_WORD: Record<string, { text: string; tone: 'warning' | 'muted' | 'success' | 'error' }> = {
  CLASH: { text: 'Clash', tone: 'warning' },
  NOT_PLANNED: { text: 'Rota not planned', tone: 'muted' },
  OK: { text: 'Enough people', tone: 'muted' },
};

/** What the ROTA column says for a row: the rota state while waiting, otherwise how it ended or where it is. */
function rotaWord(row: RequestRow): { text: string; tone: 'warning' | 'muted' | 'success' | 'error' } {
  const a = row.application;
  if (a.status === 'APPROVED') return { text: 'Approved', tone: 'success' };
  if (a.status === 'DECLINED') return { text: 'Declined', tone: 'error' };
  if (a.status === 'CANCELLED') return { text: 'Cancelled', tone: 'muted' };
  if (a.stage !== 'MANAGER' && !row.routedToMe) return { text: `With ${a.decidingRole ?? 'HR'}`, tone: 'warning' };
  return ROTA_WORD[row.rota ?? 'NOT_PLANNED'] ?? { text: '', tone: 'muted' };
}

function kpiCells(k: RequestsKpis | null, onNeedsYou: () => void): WorkforceKpiCell[] {
  if (!k) return [];
  const names = (list: string[]): string => list.join(', ');
  return [
    { key: 'needs', label: 'NEEDS YOU', value: String(k.needsYou), detail: k.needsYou > 0 ? 'waiting for your decision' : 'nothing waiting', actionable: k.needsYou > 0, onSelect: k.needsYou > 0 ? onNeedsYou : undefined },
    { key: 'today', label: 'AWAY TODAY', value: String(k.awayToday.count), detail: k.awayToday.count === 0 ? 'everyone rostered is in' : names(k.awayToday.names) },
    { key: 'next', label: 'AWAY NEXT 14 DAYS', value: String(k.awayNext14.people), detail: k.awayNext14.people === 0 ? 'nobody' : names(k.awayNext14.names) },
    { key: 'month', label: 'LEAVE DAYS THIS MONTH', value: String(k.daysThisMonth.days), detail: `across ${k.daysThisMonth.people} ${k.daysThisMonth.people === 1 ? 'person' : 'people'}` },
  ];
}

/** The Requests tab (spec Step 10): KPIs, the list (448 wide) and the chosen request with the rota beside it. `open` in the address selects a row. */
export function RequestsTab({ site, siteLabel }: { site: string | undefined; siteLabel: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const openId = search.get('open');
  const [kpis, setKpis] = React.useState<RequestsKpis | null>(null);
  const [needsYouCount, setNeedsYouCount] = React.useState(0);
  const [refresh, setRefresh] = React.useState(0);

  const setParam = React.useCallback(
    (name: string, value: string | null) => {
      const params = new URLSearchParams(search.toString());
      if (value) params.set(name, value);
      else params.delete(name);
      if (name === 'status') params.delete('page');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, search]
  );

  const columns = React.useMemo<TableColumn<RequestRow>[]>(
    () => [
      {
        id: 'person',
        header: 'PERSON',
        cell: (r, { term }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink"><HighlightMatch text={r.person.name} term={term} /></span>
            <span className="truncate font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{`${r.person.roleLabel} · ${r.application.typeLabel}${siteLabel === null && r.person.site ? ` · ${r.person.site}` : ''}`}</span>
          </span>
        ),
      },
      { id: 'dates', header: 'DATES', width: '118px', cell: (r) => <span className="font-wds-mono text-[13px] leading-4 text-wds-text-ink">{`${rangeShort(r.application.start, r.application.end)} · ${r.application.days} d`}</span> },
      { id: 'rota', header: 'ROTA', width: '104px', cell: (r) => { const w = rotaWord(r); return <StatusText tone={w.tone === 'muted' ? 'muted' : w.tone}>{w.text}</StatusText>; } },
    ],
    [siteLabel]
  );

  const filters = React.useMemo(
    // `tab` in the address is the page's Requests | Calendar | Balances, so this chip row owns `status`.
    () => [{ kind: 'chips' as const, key: 'status', options: [{ value: '', label: 'All recent' }, { value: 'needs-you', label: 'Needs you' }] }],
    []
  );

  return (
    <div className="flex flex-col gap-5">
      <WorkforceKpiStrip cells={kpiCells(kpis, () => setParam('status', 'needs-you'))} aria-label="Leave in numbers" />
      <ListDetailLayout
        listWidth={448}
        showDetail={Boolean(openId)}
        list={
          <DataTable<RequestRow>
            key={site ?? 'mine'}
            label="Leave requests"
            columns={columns}
            getRowId={(r) => r.application.id}
            filters={filters}
            counts={{ status: { 'needs-you': needsYouCount } }}
            copy={COPY}
            searchPlaceholder="Search a name"
            tableLook="workforce"
            className="border-0 bg-transparent"
            refreshToken={refresh}
            rowClassName={(r) => (r.application.id === openId ? 'bg-wds-warning-bg' : undefined)}
            onRowActivate={(r) => setParam('open', r.application.id)}
            fetchRows={async (q) => {
              const page = await leaveReads.requests({ tab: q.filters.status === 'needs-you' ? 'needs-you' : 'recent', site, q: q.search || undefined, page: q.page, rows: q.perPage });
              setKpis(page.kpis);
              setNeedsYouCount(page.kpis.needsYou);
              return { rows: page.rows, total: page.total };
            }}
          />
        }
        detail={
          openId ? (
            <RequestDetail key={openId} id={openId} onChanged={() => setRefresh((n) => n + 1)} />
          ) : (
            <p className="m-0 p-6 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Choose a request to see the rota.</p>
          )
        }
      />
    </div>
  );
}
