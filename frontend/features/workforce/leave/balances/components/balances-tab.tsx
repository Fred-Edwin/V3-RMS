'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { DataTable, type TableColumn, type TableCopy } from '@/components/ui2/data-table/data-table';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';

import { ListDetailLayout, NumberCell, WorkforceKpiStrip, type WorkforceKpiCell } from '../../../_shared';
import { LEAVE_LOAD_FAILED } from '../../_shared/lib/leave-ui';
import { RULES_LEAVE } from '../../_shared/lib/leave-routes';
import { leaveReads } from '../../_shared/services/leave-services';
import type { BalanceRow, BalancesPage } from '../../_shared/types/leave-types';
import { AdjustDialog } from './adjust-dialog';
import { BalanceDrawer } from './balance-drawer';
import { SitesPanel } from './sites-panel';

const COPY: TableCopy = {
  emptyTitle: 'Nobody is on the leave policy at this site.',
  emptyDescription: 'Leave starts when a person has a contract and the policy is set in Rules.',
  filteredEmptyTitle: 'Nothing found.',
  filteredEmptyDescription: 'Try another name, or choose All.',
  errorTitle: LEAVE_LOAD_FAILED.title,
  errorDescription: LEAVE_LOAD_FAILED.line,
};

const NOTE_TONE: Record<BalanceRow['note']['kind'], string> = { NONE: 'text-wds-text-secondary', LOW: 'text-wds-warning-fg', ADJUSTED: 'text-wds-text-secondary', BOOKED: 'text-wds-text-secondary', NOT_ON_POLICY: 'text-wds-text-secondary' };

/** The Balances tab (spec Step 14): everyone's leave in one list, the sites at the left for HR, a drawer per person. */
export function BalancesTab({ site, canAdjust, adjustOpen, onAdjustOpenChange, sitesAllowed }: { site: string | undefined; canAdjust: boolean; adjustOpen: boolean; onAdjustOpenChange: (open: boolean) => void; sitesAllowed: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [page, setPage] = React.useState<BalancesPage | null>(null);
  const [refresh, setRefresh] = React.useState(0);
  const [drawerId, setDrawerId] = React.useState<string | null>(null);
  const [prefill, setPrefill] = React.useState<{ person: { id: string; name: string; roleLabel: string } } | undefined>();

  const setFilter = (value: string): void => {
    const params = new URLSearchParams(search.toString());
    params.set('filter', value);
    params.delete('page');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const columns = React.useMemo<TableColumn<BalanceRow>[]>(
    () => [
      { id: 'person', header: 'PERSON', cell: (r, { term }) => <span className="flex min-w-0 flex-col"><span className="truncate font-wds-sans text-[14px] leading-[18px] text-wds-text-ink"><HighlightMatch text={r.name} term={term} /></span><span className="truncate font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{r.roleLabel}</span></span> },
      { id: 'dept', header: 'DEPARTMENT', width: '130px', cell: (r) => <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{r.department ?? '–'}</span> },
      { id: 'left', header: 'ANNUAL LEFT', width: '110px', align: 'right', cell: (r) => <NumberCell>{r.annualLeft === null ? '–' : `${r.annualLeft} d`}</NumberCell> },
      { id: 'booked', header: 'BOOKED', width: '80px', align: 'right', cell: (r) => <NumberCell>{r.annualBooked === null ? '–' : `${r.annualBooked} d`}</NumberCell> },
      { id: 'sick', header: 'SICK USED', width: '90px', align: 'right', cell: (r) => <NumberCell>{r.sickUsed === null ? '–' : `${r.sickUsed} d`}</NumberCell> },
      { id: 'note', header: 'NOTE', width: '190px', cell: (r) => <span className={`font-wds-sans text-[13px] leading-4 ${NOTE_TONE[r.note.kind]}`}>{r.note.text || 'None'}</span> },
    ],
    []
  );
  const filters = React.useMemo(
    () => [{ kind: 'chips' as const, key: 'filter', options: [{ value: '', label: 'All' }, { value: 'low', label: 'Low balance' }, { value: 'adjusted', label: 'Adjusted' }, { value: 'booked', label: 'Booked' }] }],
    []
  );

  const k = page?.kpis;
  const cells: WorkforceKpiCell[] = k
    ? [
        { key: 'people', label: 'PEOPLE', value: String(k.people), detail: 'on the leave policy' },
        { key: 'booked', label: 'ANNUAL DAYS BOOKED', value: String(k.bookedDays), detail: 'approved, not yet taken', onSelect: () => setFilter('booked') },
        { key: 'low', label: 'LOW BALANCE', value: String(k.lowBalance), detail: 'worth a word before year end', actionable: k.lowBalance > 0, onSelect: k.lowBalance > 0 ? () => setFilter('low') : undefined },
        { key: 'adj', label: 'ADJUSTED THIS MONTH', value: String(k.adjustedThisMonth), detail: 'with a reason, in the audit log', actionable: k.adjustedThisMonth > 0, onSelect: k.adjustedThisMonth > 0 ? () => setFilter('adjusted') : undefined },
      ]
    : [];

  const chooseSite = (id: string | undefined): void => {
    const params = new URLSearchParams(search.toString());
    if (id) params.set('site', id);
    else params.delete('site');
    params.delete('page');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const table = (
    <DataTable<BalanceRow>
      key={site ?? 'all'}
      label="Leave balances"
      columns={columns}
      getRowId={(r) => r.employeeId}
      filters={filters}
      copy={COPY}
      searchPlaceholder="Search a name"
      tableLook="workforce"
      className="border-0 bg-transparent"
      refreshToken={refresh}
      onRowActivate={(r) => setDrawerId(r.employeeId)}
      fetchRows={async (q) => {
        const result = await leaveReads.balances({ site, q: q.search || undefined, filter: (q.filters.filter as 'low' | 'adjusted' | 'booked' | undefined) ?? 'all', page: q.page, rows: q.perPage });
        setPage(result);
        return { rows: result.rows, total: result.total };
      }}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <WorkforceKpiStrip cells={cells} aria-label="Balances in numbers" />
      {canAdjust ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Where leave is defined: <a className="text-wds-primary underline" href={RULES_LEAVE}>Leave rules</a></p> : null}
      {sitesAllowed && page ? (
        <ListDetailLayout listWidth={280} list={<SitesPanel sites={page.organizations} chosen={site} onChoose={chooseSite} />} detail={<div className="min-w-0">{table}</div>} showDetail />
      ) : table}
      <BalanceDrawer employeeId={drawerId} onClose={() => setDrawerId(null)} canAdjust={canAdjust} onAdjust={(person) => { setPrefill({ person }); setDrawerId(null); onAdjustOpenChange(true); }} />
      {canAdjust ? <AdjustDialog open={adjustOpen} onOpenChange={(o) => { onAdjustOpenChange(o); if (!o) setPrefill(undefined); }} prefill={prefill} site={site} onAdjusted={() => setRefresh((n) => n + 1)} /> : null}
    </div>
  );
}
