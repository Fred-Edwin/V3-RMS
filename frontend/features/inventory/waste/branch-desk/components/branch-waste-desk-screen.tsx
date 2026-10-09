'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { DataTable, type TableColumn } from '@/components/ui2/data-table/data-table';
import { effectiveRange, nairobiToday } from '@/components/ui2/data-table/table-dates';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui2/select';
import { Skeleton } from '@/components/ui2/skeleton';
import { useAuthStore } from '@/store/authStore';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { cn } from '@/lib/cn';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { ScwKpiStrip, ScwKpiStripSkeleton } from '../../../_shared/components/scw-kpi-strip';
import { ScwTopbar } from '../../../_shared/components/scw-topbar';
import type { StateCopy } from '../../../_shared/types/state-copy';
import type { KpiCell } from '../../../_shared/types/wire';
import { clockLabel, signedMoney } from '../../../counting/_shared/lib/count-format';
import { BRANCH_WASTE_STATES_COPY } from '../../_shared/lib/branch-waste-copy';
import { WASTE_REASONS, WASTE_REASON_TEXT, type BranchWasteDepartment, type BranchWasteEntry, type WasteReason } from '../../_shared/types/waste-contract';
import { useBranchWasteAccess } from '../hooks/use-branch-waste-access';
import { qtyLabel, rangeLabel, reversalReasonShort, shortName } from '../lib/branch-waste-desk-format';
import { branchWasteDeskApi } from '../services/branch-waste-desk-api';
import { EntryDrawer } from './entry-drawer';
import { ReverseEntryDialog } from './reverse-entry-dialog';

/** Reversed-row text: `#635E57` (owner ruling, 9 Oct 2026: contrast), with the strike-through kept. This is `wds-text-secondary`. */
const FAINT = 'text-wds-text-secondary';
const DATE_FILTER = {
  kind: 'dateRange',
  fromKey: 'from',
  toKey: 'to',
  label: 'Date',
  defaultPreset: 'today',
  note: 'Later dates can’t be picked. Entries are listed by the day they were logged.',
} as const satisfies TableFilter;
const REASON_FILTER: TableFilter = { kind: 'dropdown', key: 'reason', label: 'Reason', options: WASTE_REASONS.map((value) => ({ value, label: WASTE_REASON_TEXT[value] })) };
const STATUS_FILTER: TableFilter = { kind: 'dropdown', key: 'status', label: 'Status', options: [{ value: 'logged', label: 'Active' }, { value: 'reversed', label: 'Reversed' }] };
const ALL_BRANCHES = '__all__';
const BRANCH_PARAM = 'branch';

const COPY = (list: StateCopy) => ({
  emptyTitle: 'No waste',
  emptyDescription: list.empty ?? '',
  filteredEmptyTitle: 'No waste matches',
  filteredEmptyDescription: 'No entries match. Clear filters.',
  errorTitle: 'Could not load waste',
  errorDescription: list.error,
  permissionDescription: list.permission ?? undefined,
});

/** Every cell of a row reads faint and quiet once the entry is reversed. */
const quiet = (e: BranchWasteEntry): boolean => e.status === 'REVERSED';
const ink = (e: BranchWasteEntry): string => (quiet(e) ? FAINT : 'text-wds-text-ink');

function hash(text: string): number {
  let h = 7;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 100000;
  return h;
}

/**
 * Block 3, desktop: W6 Branch waste (the Branch Manager's own branch, with Reverse) and W8 Waste for any branch (Director, Accountant,
 * Store Manager, System Admin: read only, with a Branch column and picker). One screen; the server's table decides which of the two a
 * person gets (`useBranchWasteAccess`), and the response decides what each row and cell shows: a Reverse link only where the entry
 * says `can.reverse`, money only where the key is present. A click or Enter on a row opens the entry (gap G10).
 */
export function BranchWasteDeskScreen() {
  const access = useBranchWasteAccess();
  if (access.failed) return <ScwStatePanel kind="error" text={BRANCH_WASTE_STATES_COPY.branchList.error} className="m-8" />;
  if (!access.ready) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-8" aria-hidden>
        <LoadingAnnouncer text={BRANCH_WASTE_STATES_COPY.branchList.loading} />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (access.view === 'none') return <ScwStatePanel kind="permission" text="You can read all waste. Reversing is for the Branch Manager." className="m-8" />;
  return <BranchWasteDesk everyBranch={access.view === 'all'} seesMoney={access.seesMoney} />;
}

function BranchWasteDesk({ everyBranch, seesMoney }: { everyBranch: boolean; seesMoney: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const branchName = useAuthStore((s) => s.user?.organizationName) ?? 'this branch';
  const branchId = everyBranch ? params.get(BRANCH_PARAM) ?? undefined : undefined;

  const [kpis, setKpis] = React.useState<KpiCell[] | null>(null);
  const [departments, setDepartments] = React.useState<BranchWasteDepartment[]>([]);
  const [branches, setBranches] = React.useState<{ id: string; name: string }[]>([]);
  const [refresh, setRefresh] = React.useState(0);
  const [reversing, setReversing] = React.useState<BranchWasteEntry | null>(null);
  const [opened, setOpened] = React.useState<string | null>(null);
  const titleRef = React.useRef<HTMLHeadingElement>(null);

  const filters = React.useMemo<TableFilter[]>(
    () => [DATE_FILTER, { kind: 'dropdown', key: 'departmentId', label: 'Department', options: departments.map((d) => ({ value: d.id, label: d.name })) }, REASON_FILTER, STATUS_FILTER],
    [departments],
  );

  const columns = React.useMemo<TableColumn<BranchWasteEntry>[]>(() => {
    const head = 'text-wds-text-secondary';
    const lead = 'pl-4 pr-0';
    // `pl-0 pr-0`, not `px-0`: the kit's `px-wds-4` is a custom class that tailwind-merge does not recognise as the same group as `px-0`.
    const mid = 'pl-0 pr-0';
    const all = everyBranch;
    const cols: TableColumn<BranchWasteEntry>[] = [
      { id: 'time', header: 'Time', width: all ? '72px' : '80px', className: lead, headClassName: head, cell: (e) => <span className={cn('font-wds-mono text-[12px] leading-4', ink(e))}>{clockLabel(e.at)}</span> },
      { id: 'item', header: 'Item', width: all ? '160px' : '190px', className: mid, headClassName: head, cell: (e) => <span className={cn('text-[13px] font-medium leading-4', quiet(e) ? `${FAINT} line-through` : 'text-wds-text-ink')}>{e.itemName}</span> },
      { id: 'qty', header: 'Qty', width: all ? '80px' : '90px', align: 'right', className: mid, headClassName: head, cell: (e) => <span className={cn('font-wds-mono text-[13px] leading-4', ink(e))}>{qtyLabel(e.quantity, e.unit)}</span> },
      ...(all
        ? ([{ id: 'branch', header: 'Branch', width: '130px', className: 'pl-6 pr-0', headClassName: head, cell: (e: BranchWasteEntry) => <span className={cn('text-[13px] leading-4', ink(e))}>{e.branch.name}</span> }] as TableColumn<BranchWasteEntry>[])
        : []),
      { id: 'department', header: 'Department', width: all ? '110px' : '150px', className: all ? mid : 'pl-7 pr-0', headClassName: head, cell: (e) => <span className={cn('text-[13px] leading-4', ink(e))}>{e.department.name}</span> },
      { id: 'reason', header: 'Reason', width: all ? '140px' : '150px', className: mid, headClassName: head, cell: (e) => <span className={cn('text-[13px] leading-4', ink(e))}>{e.reasonText}</span> },
      { id: 'by', header: 'Logged by', width: all ? '100px' : '120px', className: mid, headClassName: head, cell: (e) => <span className={cn('text-[13px] leading-4', ink(e))}>{shortName(e.loggedBy.name)}</span> },
      ...(seesMoney
        ? ([
            {
              id: 'value',
              header: 'Value (KES)',
              width: '100px',
              align: 'right',
              className: mid,
              headClassName: head,
              cell: (e: BranchWasteEntry) => <span className={cn('font-wds-mono text-[13px] leading-4', ink(e))}>{e.valueKes === undefined ? '' : quiet(e) ? '0' : signedMoney(e.valueKes)}</span>,
            },
          ] as TableColumn<BranchWasteEntry>[])
        : []),
      {
        id: 'status',
        header: 'Status',
        align: 'right',
        className: 'pl-0 pr-4',
        headClassName: head,
        cell: (e) =>
          e.status === 'REVERSED' && e.reversal ? (
            <span className="inline-block border border-wds-border-strong bg-wds-neutral-100 px-2 py-0.5 font-wds-sans text-[12px] leading-4 text-wds-neutral-700">
              Reversed {clockLabel(e.reversal.at)} · {reversalReasonShort(e.reversal.reason)}
            </span>
          ) : e.can.reverse ? (
            <button
              type="button"
              data-reverse-for={e.id}
              onClick={(ev) => {
                ev.stopPropagation();
                setReversing(e);
              }}
              className="relative -mr-2 h-8 px-2 font-wds-sans text-[12px] leading-4 text-wds-text-secondary outline-none transition-colors hover:bg-wds-surface-sunken hover:text-wds-text-ink focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]"
            >
              Reverse<span className="sr-only"> {e.itemName}, {qtyLabel(e.quantity, e.unit)}</span>
            </button>
          ) : null,
      },
    ];
    return cols;
  }, [everyBranch, seesMoney]);

  const setBranch = (value: string): void => {
    const q = new URLSearchParams(params.toString());
    if (value === ALL_BRANCHES) q.delete(BRANCH_PARAM);
    else q.set(BRANCH_PARAM, value);
    q.delete('page');
    router.replace(q.toString() ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const range = effectiveRange(Object.fromEntries(params.entries()), DATE_FILTER, DATE_FILTER.defaultPreset, nairobiToday());
  const when = range ? rangeLabel(range.from, range.to) : 'any time';
  const scope = everyBranch ? 'every branch' : branchName;
  const copy = COPY(everyBranch ? BRANCH_WASTE_STATES_COPY.allBranches : BRANCH_WASTE_STATES_COPY.branchList);
  const pickedBranch = branches.find((b) => b.id === branchId);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScwTopbar search={false} breadcrumb={{ section: everyBranch ? 'Branches' : 'Branch', screen: 'Waste' }} />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 ref={titleRef} tabIndex={-1} className="font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink outline-none">
              Waste
            </h1>
            <p className="m-0 max-w-[760px] font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
              {everyBranch
                ? `Everything thrown away at ${pickedBranch ? pickedBranch.name : scope}, ${when}. Read only: a wrong entry is reversed by its Branch Manager.`
                : `Everything thrown away at ${scope}, ${when}. Entries are never deleted; a wrong one is reversed.`}
            </p>
          </div>
          {everyBranch ? (
            <Select value={branchId ?? ALL_BRANCHES} onValueChange={setBranch}>
              <SelectTrigger aria-label="Branch" className="h-8 w-auto gap-1.5 !rounded-none border-wds-text-ink px-3 text-[13px] leading-4">
                <span>Branch: {pickedBranch ? pickedBranch.name : 'All branches'}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_BRANCHES}>All branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        {seesMoney ? kpis ? <ScwKpiStrip cells={kpis} variant="ink" /> : <ScwKpiStripSkeleton /> : null}

        <DataTable<BranchWasteEntry>
          label="Waste"
          look="paper"
          tableClassName="min-w-[1100px] [&_td]:whitespace-nowrap"
          columns={columns}
          getRowId={(e) => e.id}
          filters={filters}
          copy={copy}
          searchPlaceholder="Search an item or a person"
          refreshToken={refresh + hash(branchId ?? '')}
          onRowActivate={(e) => setOpened(e.id)}
          rowClassName={(e) => (quiet(e) ? 'bg-wds-neutral-50' : undefined)}
          fetchRows={async (q, { signal }) => {
            const window = effectiveRange(q.filters, DATE_FILTER, DATE_FILTER.defaultPreset, nairobiToday());
            const query = {
              search: q.search || undefined,
              departmentId: q.filters.departmentId,
              reason: q.filters.reason as WasteReason | undefined,
              status: q.filters.status as 'logged' | 'reversed' | undefined,
              from: window?.from,
              to: window?.to,
              page: q.page,
              pageSize: q.perPage as 25 | 50 | 100,
            };
            const res = everyBranch ? await branchWasteDeskApi.branches({ ...query, branchId }, signal) : await branchWasteDeskApi.branch(query, signal);
            setKpis(res.kpis ?? null);
            setDepartments(res.departments);
            if (res.branches) setBranches(res.branches);
            return { rows: res.rows, total: res.page.total };
          }}
        />
      </main>

      <ReverseEntryDialog
        entry={reversing}
        onClose={() => setReversing(null)}
        onStale={() => setRefresh((n) => n + 1)}
        fallbackFocus={() => titleRef.current}
        onDone={(done) => {
          setReversing(null);
          setRefresh((n) => n + 1);
          useWdsToastStore.getState().addToast({ variant: 'success', title: 'Entry reversed', description: `${done.itemName} · the stock went back.` });
        }}
      />
      <EntryDrawer entryId={opened} onClose={() => setOpened(null)} />
    </div>
  );
}
