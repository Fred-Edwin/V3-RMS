'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { DataTable, type TableColumn } from '@/components/ui2/data-table/data-table';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';
import { effectiveRange, nairobiToday } from '@/components/ui2/data-table/table-dates';
import { Skeleton } from '@/components/ui2/skeleton';
import { useAuthStore } from '@/store/authStore';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { Chip } from '../../../_shared/components/block2-phone-parts';
import { BRANCH_DAY_STATES_COPY, dayStatusChip } from '../../_shared/lib/branch-day-copy';
import type { BranchRef, DayStatus, HistoryRow } from '../../_shared/types/branch-day-contract';
import { DAY_STATUSES } from '../../_shared/types/branch-day-contract';
import { useDayAccess, useDayBase } from '../hooks/use-day-access';
import { dayPaths } from '../lib/desk-paths';
import { longDay } from '../lib/desk-format';
import { kes } from '../lib/desk-format';
import { branchDayDeskApi } from '../services/branch-day-desk-api';
import { DayTopbar } from './day-topbar';
import { PRESS } from './day-parts';

const DATE_FILTER = {
  kind: 'dateRange',
  fromKey: 'from',
  toKey: 'to',
  label: 'Date',
  defaultPreset: 'last7',
  note: 'Later dates can’t be picked. The list shows every branch day in the range.',
} as const satisfies TableFilter;

const STATUS_FILTER: TableFilter = { kind: 'dropdown', key: 'status', label: 'Status', options: DAY_STATUSES.map((value) => ({ value, label: dayStatusChip(value) })) };

const COPY = {
  emptyTitle: 'No days',
  emptyDescription: BRANCH_DAY_STATES_COPY.history.empty,
  filteredEmptyTitle: 'No days match',
  filteredEmptyDescription: 'No days match. Clear filters.',
  errorTitle: 'Could not load the days',
  errorDescription: BRANCH_DAY_STATES_COPY.history.error,
};

const STATUS_TONE: Record<DayStatus, 'info' | 'success' | 'warning'> = { OPEN: 'info', CLOSED: 'success', CORRECTED: 'warning' };
const HEAD = 'text-wds-text-secondary';

/**
 * Block 4, desktop: History (Paper B10) and History across branches (B10b). One table on the kit's `DataTable`: search by day number as you
 * type, "Date: Last 7 days" and "Status" (and "Branch" for a hub role) in the toolbar, the numbered pager with rows per page, all in the
 * URL. Step 10's geometry for both (conflict C11): gap 16, 130/110/130/100/130, and the Branch column (110) for hub roles only. An open
 * day goes to Today (gap G11); a closed one to its file.
 */
export function HistoryScreen() {
  const access = useDayAccess();
  if (access.failed) return <ScwStatePanel kind="error" text={BRANCH_DAY_STATES_COPY.history.error} className="m-8" />;
  if (!access.ready) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-8" aria-hidden="true">
        <LoadingAnnouncer text={BRANCH_DAY_STATES_COPY.history.loading} />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (access.view === 'none') return <ScwStatePanel kind="permission" text={BRANCH_DAY_STATES_COPY.today.permission} className="m-8" />;
  return <HistoryTable everyBranch={access.view === 'all'} seesMoney={access.seesMoney} />;
}

function HistoryTable({ everyBranch, seesMoney }: { everyBranch: boolean; seesMoney: boolean }) {
  const router = useRouter();
  const base = useDayBase();
  const paths = dayPaths(base);
  const ownBranch = useAuthStore((s) => s.user?.organizationName) ?? 'This branch';
  const [branches, setBranches] = React.useState<BranchRef[]>([]);

  const filters = React.useMemo<TableFilter[]>(
    () => [
      ...(everyBranch ? ([{ kind: 'dropdown', key: 'branch', label: 'Branch', options: branches.map((b) => ({ value: b.id, label: b.name })) }] as TableFilter[]) : []),
      DATE_FILTER,
      STATUS_FILTER,
    ],
    [everyBranch, branches],
  );

  // A day closed under the old flow has no Used value and no file (contract §0.4): it shows "–" and is not a link.
  const noFile = React.useCallback((row: HistoryRow): boolean => seesMoney && row.status !== 'OPEN' && row.usedValueKes === null, [seesMoney]);
  const open = React.useCallback(
    (row: HistoryRow): void => {
      if (noFile(row)) return;
      router.push(row.status === 'OPEN' ? paths.today(everyBranch ? row.branch.id : undefined) : paths.file(row.id));
    },
    [router, paths, everyBranch, noFile],
  );

  const columns = React.useMemo<TableColumn<HistoryRow>[]>(() => {
    // `pl-0 pr-4`, not `px-…`: the kit's `px-wds-4` is a custom class tailwind-merge does not treat as the same group.
    const mid = 'pl-0 pr-4';
    const cols: TableColumn<HistoryRow>[] = [
      {
        id: 'day',
        header: 'Day',
        className: 'pl-2 pr-4',
        headClassName: HEAD,
        cell: (r, { term }) => (
          <div className="flex flex-col gap-0.5">
            {noFile(r) ? (
              <span className="self-start font-wds-mono text-[14px] leading-[18px] text-wds-text-secondary">
                <HighlightMatch text={r.reference} term={term} />
              </span>
            ) : (
              <Link
                href={r.status === 'OPEN' ? paths.today(everyBranch ? r.branch.id : undefined) : paths.file(r.id)}
                onClick={(e) => e.stopPropagation()}
                className={`${PRESS} self-start font-wds-mono text-[14px] leading-[18px] text-[#1F5BAE] underline underline-offset-2 outline-none focus-visible:shadow-wds-ring`}
              >
                <HighlightMatch text={r.reference} term={term} />
              </Link>
            )}
            <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{longDay(r.date)}</span>
          </div>
        ),
      },
      ...(everyBranch
        ? ([{ id: 'branch', header: 'Branch', width: '110px', className: mid, headClassName: HEAD, cell: (r: HistoryRow) => <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{r.branch.name}</span> }] as TableColumn<HistoryRow>[])
        : []),
      {
        id: 'counted',
        header: 'Departments counted',
        width: '130px',
        className: mid,
        headClassName: HEAD,
        cell: (r) => <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{r.departmentsCounted} of {r.departmentsTotal}</span>,
      },
      ...(seesMoney
        ? ([
            { id: 'used', header: 'Used value (KES)', width: '110px', align: 'right', className: mid, headClassName: HEAD, cell: (r: HistoryRow) => <Figure value={r.usedValueKes} /> },
            { id: 'closing', header: 'Closing stock value (KES)', width: '130px', align: 'right', className: mid, headClassName: HEAD, cell: (r: HistoryRow) => <Figure value={r.closingValueKes} /> },
          ] as TableColumn<HistoryRow>[])
        : []),
      {
        id: 'status',
        header: 'Status',
        width: '100px',
        className: mid,
        headClassName: HEAD,
        cell: (r) => <Chip spec={{ text: dayStatusChip(r.status), tone: STATUS_TONE[r.status], dot: true }} dotShape="square" />,
      },
      {
        id: 'by',
        header: 'Closed by',
        width: '130px',
        className: 'pl-0 pr-2',
        headClassName: HEAD,
        cell: (r) => (r.closedBy ? <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{r.closedBy.name}</span> : <span className="font-wds-sans text-[14px] leading-[18px] text-[#8D8982]">–</span>),
      },
    ];
    return cols;
  }, [everyBranch, seesMoney, paths, noFile]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DayTopbar breadcrumb={everyBranch ? { section: 'Branches', screen: 'Day' } : { root: 'Branch', section: 'Day', sectionHref: paths.today(), screen: 'History' }} />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 pb-10 pt-7">
        <div className="flex flex-col gap-1">
          <h1 tabIndex={-1} className="m-0 font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink outline-none">
            {everyBranch ? 'Day history' : 'History'}
          </h1>
          <p className="m-0 font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">{everyBranch ? 'All branches' : ownBranch} · every branch day, newest first</p>
        </div>
        <DataTable<HistoryRow>
          label="Branch days"
          columns={columns}
          getRowId={(r) => r.id}
          filters={filters}
          copy={COPY}
          rowSize="two-line"
          tableClassName={everyBranch ? 'min-w-[1000px]' : 'min-w-[880px]'}
          searchPlaceholder="Search by day number"
          onRowActivate={open}
          fetchRows={async (q, { signal }) => {
            const range = effectiveRange(q.filters, DATE_FILTER, DATE_FILTER.defaultPreset, nairobiToday());
            const res = await branchDayDeskApi.history(
              {
                q: q.search || undefined,
                branchId: everyBranch ? q.filters.branch || undefined : undefined,
                from: range?.from,
                to: range?.to,
                status: (q.filters.status || undefined) as DayStatus | undefined,
                page: q.page,
                pageSize: q.perPage as 25 | 50 | 100,
              },
              signal,
            );
            if (res.branches) setBranches(res.branches);
            return { rows: res.rows, total: res.page.total };
          }}
        />
      </main>
    </div>
  );
}

/** A money cell: "–" in faint grey while the day is open. */
function Figure({ value }: { value: string | null | undefined }) {
  return value === null || value === undefined ? (
    <span className="font-wds-mono text-[14px] leading-[18px] text-[#8D8982]">–</span>
  ) : (
    <span className="font-wds-mono text-[14px] leading-[18px] text-wds-text-ink">{kes(value)}</span>
  );
}
