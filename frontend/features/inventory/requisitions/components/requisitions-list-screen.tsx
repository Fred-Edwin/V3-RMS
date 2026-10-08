'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Topbar } from '@/components/app/shell/topbar';
import { Button } from '@/components/ui2/button';
import { DataTable, type TableColumn } from '@/components/ui2/data-table/data-table';
import { effectiveRange, nairobiToday } from '@/components/ui2/data-table/table-dates';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';
import { useAuthStore } from '@/store/authStore';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { formatApiErrorMessage } from '@/types/api';
import { LoadingAnnouncer } from '../../_shared/components/scw-states';
import { useLoader } from '../../_shared/hooks/use-async';
import { usePermissions } from '../../_shared/hooks/use-permissions';
import { departmentsApi } from '../../departments/services/departments-api';
import { requisitionsApi } from '../_shared/services/requisitions-api';
import { CYCLE_TEXT, REQUISITION_CYCLES, type BranchRef, type RequisitionRow, type RequisitionTab, type TabCounts } from '../_shared/types/requisitions-contract';
import { clock, dayAndClock, dayLabel, elapsed, kes } from '../_shared/lib/requisitions-words';
import { LIST_COPY } from '../_shared/lib/list-copy';
import { DocLink, ReqTabs, SectionSquares, StatusChip, UrgentTag, type TabDef } from './req-parts';
import { StartDialog } from './start-dialog';

export type ListMode = 'queue' | 'discrepancies' | 'history';

/** The five stage tabs Paper draws; Discrepancies and History are sidebar sub-links that call R1 with their own tab. */
const QUEUE_TABS: readonly { key: RequisitionTab; label: string }[] = [
  { key: 'collecting', label: 'Collecting' },
  { key: 'to-approve', label: 'To approve' },
  { key: 'to-pack', label: 'To pack' },
  { key: 'on-the-way', label: 'On the way' },
  { key: 'to-confirm', label: 'To confirm' },
];

const DATE_FILTER = { kind: 'dateRange', fromKey: 'from', toKey: 'to', label: 'Date', defaultPreset: 'last30', allowAny: true } as const satisfies TableFilter;

const isTab = (value: string | null): value is RequisitionTab => value !== null && [...QUEUE_TABS.map((t) => t.key), 'discrepancies', 'closed'].includes(value);

/**
 * Paper steps 7, 7b, 7c, 7d and 18b: one list for every role. A hub role gets a Branch column and filter (the response carries
 * `branches`), money shows only where the rows carry `valueKes`, and each role opens on the tab the server picks for them. The
 * tab, page, search and filters live in the URL.
 */
export function RequisitionsListScreen({ base, mode }: { base: string; mode: ListMode }) {
  const router = useRouter();
  const params = useSearchParams();
  const role = useAuthStore((s) => s.user?.role);
  const { can, ready } = usePermissions();
  const [tabCounts, setTabCounts] = React.useState<TabCounts | null>(null);
  const [activeTab, setActiveTab] = React.useState<RequisitionTab | null>(null);
  const [waiting, setWaiting] = React.useState(0);
  const [branches, setBranches] = React.useState<BranchRef[] | null>(null);
  const [showValue, setShowValue] = React.useState(false);
  const [overHour, setOverHour] = React.useState<RequisitionRow | null>(null);
  const [refresh, setRefresh] = React.useState(0);
  const [startOpen, setStartOpen] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  const departments = useLoader(ready ? 'departments' : null, () => departmentsApi.list(), 'Could not load departments.');

  // Elapsed times tick once a minute.
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const urlTab = params.get('tab');
  const forcedTab: RequisitionTab | undefined = mode === 'discrepancies' ? 'discrepancies' : mode === 'history' ? 'closed' : isTab(urlTab) && urlTab !== 'discrepancies' && urlTab !== 'closed' ? urlTab : undefined;
  const hub = branches !== null;
  const canStart = can('requisitions.start') && role !== 'SYSTEM_ADMIN' && mode === 'queue';
  const href = (id: string): string => `${base}/${id}`;

  const setTab = (tab: RequisitionTab): void => {
    const q = new URLSearchParams(params.toString());
    q.set('tab', tab);
    q.delete('page');
    router.replace(`${base}?${q}`, { scroll: false });
  };

  const nudge = async (row: RequisitionRow): Promise<void> => {
    const departmentId = row.rowAction?.departmentId;
    if (!departmentId) return;
    try {
      await requisitionsApi.nudge(row.id, departmentId);
      useWdsToastStore.getState().addToast({ variant: 'success', title: 'Nudge sent', description: `${row.rowAction?.label.replace('Nudge ', '')} has been told.` });
    } catch (err) {
      useWdsToastStore.getState().addToast({ variant: 'error', title: 'Could not nudge', description: formatApiErrorMessage(err, 'Try again.') });
    }
  };

  const rowAction = (row: RequisitionRow): React.ReactNode => {
    const action = row.rowAction;
    if (!action) return null;
    // The over-an-hour urgent row of the Director's list is answered by the banner under the table instead.
    if (row.urgentOverHour && action.action === 'APPROVE_AND_SIGN' && hub) return null;
    const run = (): void => {
      if (action.action === 'NUDGE') void nudge(row);
      else if (action.action === 'APPROVE_AND_SIGN') router.push(`${href(row.id)}?drawer=approve`);
      else router.push(href(row.id));
    };
    return (
      <Button variant="secondary" onClick={(event) => { event.stopPropagation(); run(); }} className="h-10 px-5 text-[14px]">
        {action.action === 'APPROVE_AND_SIGN' ? 'Review and approve' : action.label}
        <span className="sr-only"> {row.reference}</span>
      </Button>
    );
  };

  const filters = React.useMemo<TableFilter[]>(() => {
    const list: TableFilter[] = [];
    if (mode === 'history') list.push({ kind: 'dropdown', key: 'branchId', label: 'Branch', options: (branches ?? []).map((b) => ({ value: b.id, label: b.name })) }, DATE_FILTER, { kind: 'dropdown', key: 'status', label: 'Status', options: [{ value: 'CLOSED', label: 'Closed' }, { value: 'CANCELLED', label: 'Cancelled' }] });
    else {
      if (hub) list.push({ kind: 'dropdown', key: 'branchId', label: 'Branch', options: (branches ?? []).map((b) => ({ value: b.id, label: b.name })) });
      if (mode === 'queue' && !hub) list.push({ kind: 'dropdown', key: 'cycle', label: 'Cycle', options: REQUISITION_CYCLES.map((c) => ({ value: c, label: CYCLE_TEXT[c] })) });
      list.push({ kind: 'dropdown', key: 'departmentId', label: 'Department', options: (departments.data?.rows ?? []).map((d) => ({ value: d.id, label: d.name })) });
      if (mode === 'queue') list.push({ kind: 'dropdown', key: 'urgent', label: 'Urgent', options: [{ value: 'true', label: 'Urgent only' }] });
    }
    return list;
  }, [mode, hub, branches, departments.data]);

  const columns = React.useMemo<TableColumn<RequisitionRow>[]>(() => {
    const tab = forcedTab ?? activeTab ?? 'to-approve';
    const history = mode === 'history';
    const requisition: TableColumn<RequisitionRow> = {
      id: 'requisition',
      header: 'Requisition',
      cell: (r, { term }) => (
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2.5">
            <DocLink href={href(r.id)}>
              <HighlightMatch text={r.reference} term={term} />
            </DocLink>
            {r.urgent ? <UrgentTag /> : null}
          </span>
          <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{subline(r, tab, history)}</span>
        </div>
      ),
    };
    const branch: TableColumn<RequisitionRow> = { id: 'branch', header: 'Branch', width: '170px', cell: (r) => <span className="font-wds-sans text-[14px] text-wds-text-ink">{r.branch.name}</span> };
    const lines: TableColumn<RequisitionRow> = { id: 'lines', header: 'Lines', width: '80px', align: 'right', cell: (r) => <span className="font-wds-mono text-[14px] text-wds-text-ink">{r.lineCount}</span> };
    const value: TableColumn<RequisitionRow> = {
      id: 'value',
      header: tab === 'collecting' ? 'Value so far (KES)' : 'Value (KES)',
      width: '150px',
      align: 'right',
      cell: (r) => <span className="font-wds-mono text-[14px] text-wds-text-ink">{r.valueKes === undefined ? '' : kes(r.valueKes)}</span>,
    };
    const sections: TableColumn<RequisitionRow> = {
      id: 'sections',
      header: tab === 'to-approve' ? 'Sections in' : 'Sections',
      width: '230px',
      cell: (r) => {
        const done = r.sections.filter((s) => s.status === 'SUBMITTED' || s.status === 'SKIPPED').length;
        const missing = r.sections.find((s) => s.status === 'NOT_STARTED' || s.status === 'DRAFT');
        return (
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2.5">
              <SectionSquares sections={r.sections} />
              <span className="font-wds-sans text-[14px] text-wds-text-ink">{done === r.sections.length ? (r.sections.length === 1 ? '1 of 1 in' : `All ${r.sections.length} in`) : `${done} of ${r.sections.length} in`}</span>
            </span>
            {tab === 'collecting' && missing ? <span className="font-wds-sans text-[13px] text-wds-text-secondary">Waiting for {missing.departmentName}</span> : null}
          </div>
        );
      },
    };
    const time: TableColumn<RequisitionRow> = {
      id: 'time',
      header: tab === 'collecting' ? 'Open for' : hub ? 'Unapproved for' : 'Waiting',
      width: '120px',
      cell: (r) => {
        const from = tab === 'collecting' ? r.openedAt : hub && r.urgentAt ? r.urgentAt : (r.allInAt ?? r.openedAt);
        return <span className={r.urgentOverHour ? 'font-wds-mono text-[14px] text-wds-error-fg' : 'font-wds-mono text-[14px] text-wds-text-ink'}>{elapsed(from, now)}</span>;
      },
    };
    const action: TableColumn<RequisitionRow> = { id: 'action', header: <span className="sr-only">Action</span>, width: '190px', align: 'right', cell: (r) => rowAction(r) };
    const closed: TableColumn<RequisitionRow> = { id: 'closed', header: 'Closed', width: '190px', cell: (r) => <span className="font-wds-sans text-[14px] text-wds-text-ink">{dayAndClockOrDash(r.closedAt ?? r.cancelledAt)}</span> };
    const status: TableColumn<RequisitionRow> = {
      id: 'status',
      header: 'Status',
      width: '150px',
      cell: (r) => <StatusChip chip={r.status === 'CANCELLED' ? { text: 'Cancelled', tone: 'neutral' } : r.status === 'CLOSED' ? { text: 'Closed', tone: 'success' } : { text: r.statusText, tone: 'info' }} />,
    };

    if (history) return [requisition, ...(hub ? [branch] : []), closed, lines, status];
    if (mode === 'discrepancies') return [requisition, ...(hub ? [branch] : []), sections, lines, status];
    if (tab === 'collecting') return [requisition, ...(hub ? [branch] : []), sections, lines, ...(showValue ? [value] : []), time, action];
    if (tab === 'to-approve') return [requisition, ...(hub ? [branch] : []), sections, lines, ...(showValue ? [value] : []), time, action];
    return [requisition, ...(hub ? [branch] : []), sections, lines, ...(showValue ? [value] : []), status, action];
    // `href` and `rowAction` close over the base path and router, which do not change for the life of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, forcedTab, activeTab, hub, showValue, now]);

  const tabs: TabDef<RequisitionTab>[] = QUEUE_TABS.map((t) => ({ key: t.key, label: t.label, count: tabCounts?.[t.key], dark: waiting > 0 && t.key === dataTabForWaiting(activeTab, tabCounts, role) }));
  const title = mode === 'history' ? 'History' : mode === 'discrepancies' ? 'Discrepancies' : 'Requisitions';
  const subtitle =
    mode === 'history'
      ? 'Requisitions that are closed or cancelled. Nothing here can be changed; open one to read it or print it.'
      : mode === 'discrepancies'
        ? `Every gap between what was sent and what a branch counted. ${hub ? 'All branches' : (branchName(branches, params) ?? 'This branch')} · ${dayLabel(new Date().toISOString())}`
        : `${hub ? 'All branches' : (departmentsBranch(departments.data?.branch.name) ?? 'This branch')} · ${new Date().toLocaleDateString('en-GB', { timeZone: 'Africa/Nairobi', weekday: 'long', day: 'numeric', month: 'long' })}`;
  const crumb = hub || role === 'DIRECTOR' || role === 'STORE_MANAGER' || role === 'ACCOUNTANT' || role === 'STORE_ATTENDANT' || role === 'SYSTEM_ADMIN' ? 'Central Store' : 'Branch';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        hideSearch
        breadcrumb={mode === 'queue' ? { section: crumb, screen: 'Requisitions' } : { root: crumb, section: 'Requisitions', sectionHref: base, screen: title }}
        actions={canStart ? <Button onClick={() => setStartOpen(true)}>Start a requisition</Button> : undefined}
      />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-mobile-title tracking-tight text-wds-text-ink">{title}</h1>
          <p className="font-wds-sans text-[15px] leading-5 text-wds-text-secondary">{subtitle}</p>
        </div>
        {mode === 'queue' ? <ReqTabs label="Requisition stage" tabs={tabs} active={forcedTab ?? activeTab ?? 'to-approve'} onChange={setTab} /> : null}
        <DataTable<RequisitionRow>
          label={title}
          columns={columns}
          getRowId={(r) => r.id}
          filters={filters}
          copy={LIST_COPY[mode === 'queue' ? (forcedTab ?? activeTab ?? 'to-approve') : mode]}
          enabled={ready}
          refreshToken={refresh}
          searchPlaceholder={mode === 'history' ? 'Search by number or branch' : hub ? 'Search by number or branch' : 'Search by number or department'}
          onRowActivate={(r) => router.push(href(r.id))}
          fetchRows={async (q, { signal: _signal }) => {
            const range = mode === 'history' ? effectiveRange(q.filters, DATE_FILTER, DATE_FILTER.defaultPreset, nairobiToday()) : undefined;
            const res = await requisitionsApi.list({
              tab: forcedTab,
              q: q.search || undefined,
              branchId: q.filters.branchId,
              cycle: q.filters.cycle as (typeof REQUISITION_CYCLES)[number] | undefined,
              departmentId: q.filters.departmentId,
              urgent: q.filters.urgent === 'true' ? true : undefined,
              status: q.filters.status as 'CLOSED' | 'CANCELLED' | undefined,
              from: range?.from,
              to: range?.to,
              page: q.page,
              pageSize: q.perPage as 25 | 50 | 100,
            });
            setTabCounts(res.tabCounts);
            setActiveTab(res.tab);
            setWaiting(res.waitingForYou);
            setBranches(res.branches ?? null);
            setShowValue(res.rows.some((r) => r.valueKes !== undefined));
            setOverHour(res.rows.find((r) => r.urgentOverHour && r.rowAction?.action === 'APPROVE_AND_SIGN') ?? null);
            return { rows: res.rows, total: res.page.total };
          }}
        />
        {mode === 'queue' && overHour && hub ? (
          <div role="status" className="flex items-center justify-between gap-6 border border-wds-info-border bg-wds-info-bg px-5 py-4">
            <div className="flex items-start gap-3">
              <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-wds-info-fg" />
              <p className="font-wds-sans text-[15px] leading-[22px] text-wds-text-ink">
                You are told because this urgent requisition has waited over an hour. You can approve it yourself with your PIN, or leave it to the Branch Manager.
              </p>
            </div>
            <Button onClick={() => router.push(`${href(overHour.id)}?drawer=approve`)} className="shrink-0">
              Open and approve
              <span className="sr-only"> {overHour.reference}</span>
            </Button>
          </div>
        ) : null}
        <LoadingAnnouncer text="" />
      </main>
      <StartDialog open={startOpen} onOpenChange={setStartOpen} onStarted={(id) => { setRefresh((n) => n + 1); router.push(href(id)); }} />
    </div>
  );
}

const dayAndClockOrDash = (iso: string | null): string => (iso ? dayAndClock(iso) : '—');

const branchName = (branches: BranchRef[] | null, params: URLSearchParams | { get: (k: string) => string | null }): string | null => {
  const id = params.get('branchId');
  return branches?.find((b) => b.id === id)?.name ?? null;
};
const departmentsBranch = (name: string | undefined): string | null => name ?? null;

/** Which tab wears the dark count badge: the one holding what waits for this role. */
function dataTabForWaiting(active: RequisitionTab | null, counts: TabCounts | null, role: string | undefined): RequisitionTab | null {
  if (!counts) return active;
  if (role === 'STORE_MANAGER' || role === 'STORE_ATTENDANT') return 'to-pack';
  return 'to-approve';
}

/** The grey line under a document number: "Afternoon · started 1:41 pm", "Extra · Service only", the cancel reason. */
function subline(r: RequisitionRow, tab: RequisitionTab, history: boolean): string {
  const cycle = r.cycleLabel.split(' · ')[0] ?? r.cycleLabel;
  if (history) {
    if (r.status === 'CANCELLED') return `${cycle} · ${r.sections.length === 1 ? `${r.sections[0]?.departmentName} only` : `${r.sections.length} departments`}${r.cancelReason ? ` · cancelled before approval: "${r.cancelReason}"` : ''}`;
    return `${cycle} · ${r.sections.length} departments`;
  }
  if (r.urgent && r.urgentNote) return `${cycle} · ${r.sections.length === 1 ? `${r.sections[0]?.departmentName} only` : `${r.sections.length} departments`} · "${r.urgentNote}"`;
  if (r.sections.length === 1) return `${cycle} · ${r.sections[0]?.departmentName} only`;
  return tab === 'collecting' || tab === 'to-approve' ? `${cycle} · started ${clock(r.openedAt)}` : `${cycle} · ${r.sections.length} departments`;
}
