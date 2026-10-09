'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Topbar } from '@/components/app/shell/topbar';
import { Button } from '@/components/ui2/button';
import { DataTable, type TableColumn, type TableCopy } from '@/components/ui2/data-table/data-table';
import { effectiveRange, nairobiToday } from '@/components/ui2/data-table/table-dates';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';
import { useLoader } from '../../_shared/hooks/use-async';
import { usePermissions } from '../../_shared/hooks/use-permissions';
import { departmentsApi } from '../../departments/services/departments-api';
import { DocLink, ReqTabs, type TabDef } from '../../requisitions/components/req-parts';
import { dayLabel, elapsed } from '../../requisitions/_shared/lib/requisitions-words';
import { COUNT_REASON_TEXT } from '../../dispatch/_shared/types/dispatch-contract';
import { EMPTY } from '../../dispatch/lib/dispatch-words';
import { useRecordNudge } from '../../dispatch/hooks/use-record-nudge';
import { discrepanciesApi } from '../../dispatch/services/branch-side-api';
import { FINDING_TEXT, type DiscrepancyRow, type DiscrepancyTab, type ListDiscrepancies } from '../_shared/types/discrepancies-contract';

const SETTLED_DATE = { kind: 'dateRange', fromKey: 'from', toKey: 'to', label: 'Date', defaultPreset: 'last30', allowAny: true } as const satisfies TableFilter;
const error = { errorTitle: "Couldn't load discrepancies", errorDescription: 'Check your connection and try again.' } as const;
const filtered = { filteredEmptyTitle: 'No discrepancy matches', filteredEmptyDescription: 'Clear the search or a filter to see more.' } as const;
const COPY: Record<DiscrepancyTab, TableCopy> = {
  open: { emptyTitle: EMPTY.open.title, emptyDescription: EMPTY.open.line, ...filtered, ...error },
  settled: { emptyTitle: EMPTY.settled.title, emptyDescription: EMPTY.settled.line, ...filtered, ...error },
};

const gapLabel = (gap: string): string => {
  const n = Number(gap);
  return n > 0 ? `+${n}` : `${n}`;
};
const openedFor = (iso: string, now: number): { text: string; late: boolean } => ({ text: elapsed(iso, now), late: now - new Date(iso).getTime() >= 24 * 3600000 });

/** Paper 7c: every gap between what was sent and what a branch counted. Open and Settled tabs, search, branch and department filters, a numbered pager. */
export function DiscrepanciesListScreen({ base, section: crumb }: { base: string; section: 'Branch' | 'Central Store' }) {
  const router = useRouter();
  const params = useSearchParams();
  const { ready } = usePermissions();
  const [counts, setCounts] = React.useState<ListDiscrepancies['counts'] | null>(null);
  const [branches, setBranches] = React.useState<ListDiscrepancies['branches']>(undefined);
  const [refresh, setRefresh] = React.useState(0);
  const [now, setNow] = React.useState(() => Date.now());
  const phone = useMediaQuery('(max-width: 639px)').matches;
  const departments = useLoader(ready ? 'departments' : null, () => departmentsApi.list(), 'Could not load departments.');
  const tab: DiscrepancyTab = params.get('tab') === 'settled' ? 'settled' : 'open';
  const hub = branches !== undefined;

  useRecordNudge(() => setRefresh((n) => n + 1));
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const href = (id: string): string => `${base}/discrepancies/${id}`;
  const setTab = (next: DiscrepancyTab): void => {
    const q = new URLSearchParams(params.toString());
    q.set('tab', next);
    q.delete('page');
    q.delete('from');
    q.delete('to');
    router.replace(`${base}/discrepancies?${q}`, { scroll: false });
  };

  const filters = React.useMemo<TableFilter[]>(() => {
    const list: TableFilter[] = [];
    if (hub) list.push({ kind: 'dropdown', key: 'branchId', label: 'Branch', options: (branches ?? []).map((b) => ({ value: b.id, label: b.name })) });
    list.push({ kind: 'dropdown', key: 'departmentId', label: 'Department', options: (departments.data?.rows ?? []).map((d) => ({ value: d.id, label: d.name })) });
    if (tab === 'settled') list.push(SETTLED_DATE);
    return list;
  }, [hub, branches, departments.data, tab]);

  const columns = React.useMemo<TableColumn<DiscrepancyRow>[]>(() => {
    const discrepancy: TableColumn<DiscrepancyRow> = {
      id: 'discrepancy',
      header: 'Discrepancy',
      cell: (r, { term }) => {
        const late = tab === 'open' && r.reminderSentAt !== null;
        return (
          <div className="flex flex-col gap-1">
            <DocLink href={href(r.id)}>
              <HighlightMatch text={r.reference} term={term} />
            </DocLink>
            <span className={cn('font-wds-sans text-[13px] leading-[18px]', late ? 'text-wds-error-fg' : 'text-wds-text-secondary')}>
              <HighlightMatch text={r.itemName} term={term} /> · {r.department.name}
              {late ? ' · reminder sent after 24 hours' : r.branchReason ? ` · counted twice, ${COUNT_REASON_TEXT[r.branchReason].toLowerCase()}` : ''}
            </span>
          </div>
        );
      },
    };
    const branch: TableColumn<DiscrepancyRow> = { id: 'branch', header: 'Branch', width: '170px', cell: (r) => <span className="font-wds-sans text-[14px] text-wds-text-ink">{r.branch.name}</span> };
    const delivery: TableColumn<DiscrepancyRow> = { id: 'delivery', header: 'Delivery', width: '170px', cell: (r, { term }) => <DocLink href={`${base}/dispatch/${r.dispatch.id}`}><HighlightMatch text={r.dispatch.reference} term={term} /></DocLink> };
    const gap: TableColumn<DiscrepancyRow> = { id: 'gap', header: 'Gap', width: '80px', align: 'right', cell: (r) => <span className="font-wds-mono text-[14px] font-semibold text-wds-warning-fg">{gapLabel(r.gapQty)}</span> };
    const openFor: TableColumn<DiscrepancyRow> = {
      id: 'openFor',
      header: 'Open for',
      width: '150px',
      align: 'right',
      cell: (r) => {
        const o = openedFor(r.openedAt, now);
        return <span className={cn('whitespace-nowrap font-wds-mono text-[14px]', o.late ? 'text-wds-error-fg' : 'text-wds-text-ink')}>{o.text}</span>;
      },
    };
    const finding: TableColumn<DiscrepancyRow> = { id: 'finding', header: 'Finding', width: '220px', cell: (r) => <span className="font-wds-sans text-[14px] text-wds-text-ink">{r.finding ? FINDING_TEXT[r.finding.finding] : '—'}</span> };
    const recorded: TableColumn<DiscrepancyRow> = { id: 'recorded', header: 'Recorded', width: '120px', cell: (r) => <span className="font-wds-sans text-[14px] text-wds-text-secondary">{r.finding ? dayLabel(r.finding.recorded.at) : '—'}</span> };
    const action: TableColumn<DiscrepancyRow> = {
      id: 'action',
      header: <span className="sr-only">Action</span>,
      width: '180px',
      align: 'right',
      cell: (r) =>
        tab === 'open' && r.can.recordFinding ? (
          <Button onClick={(event) => { event.stopPropagation(); router.push(`${href(r.id)}?drawer=finding`); }} className="h-10 px-5 text-[14px]">
            Record a finding<span className="sr-only"> for {r.reference}</span>
          </Button>
        ) : (
          <Button variant="secondary" onClick={(event) => { event.stopPropagation(); router.push(href(r.id)); }} className="h-10 px-5 text-[14px]">
            Open<span className="sr-only"> {r.reference}</span>
          </Button>
        ),
    };
    return tab === 'open' ? [discrepancy, ...(hub ? [branch] : []), delivery, gap, openFor, action] : [discrepancy, ...(hub ? [branch] : []), delivery, gap, finding, recorded, action];
    // `href` and `router` do not change for the life of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hub, now]);

  const tabs: TabDef<DiscrepancyTab>[] = [
    { key: 'open', label: 'Open', count: counts?.open, dark: true },
    { key: 'settled', label: 'Settled', count: counts?.settled },
  ];
  const scope = hub ? 'All branches' : 'This branch';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar hideSearch breadcrumb={{ root: crumb, section: 'Requisitions', sectionHref: base, screen: 'Discrepancies' }} />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-mobile-title tracking-[-0.01em] text-wds-text-ink">Discrepancies</h1>
          <p className="font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">Every gap between what was sent and what a branch counted. {scope} · {new Date().toLocaleDateString('en-GB', { timeZone: 'Africa/Nairobi', weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <ReqTabs label="Discrepancies" tabs={tabs} active={tab} onChange={setTab} />
        <DataTable<DiscrepancyRow>
          label="Discrepancies"
          layout={phone ? 'cards' : 'table'}
          renderCard={(r, { term }) => (
            <div className="flex flex-col gap-2 border-b border-wds-neutral-100 px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <DocLink href={href(r.id)}><HighlightMatch text={r.reference} term={term} /></DocLink>
                <span className="font-wds-mono text-[14px] font-semibold text-wds-warning-fg">{gapLabel(r.gapQty)}</span>
              </div>
              <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{r.itemName} · {r.department.name} · {r.branch.name}</span>
              <div className="flex items-center justify-between gap-3">
                <span className="font-wds-mono text-[13px] text-wds-text-ink">{tab === 'open' ? openedFor(r.openedAt, now).text : r.finding ? FINDING_TEXT[r.finding.finding] : ''}</span>
                <Button variant={tab === 'open' && r.can.recordFinding ? 'primary' : 'secondary'} onClick={() => router.push(tab === 'open' && r.can.recordFinding ? `${href(r.id)}?drawer=finding` : href(r.id))} className="h-11 px-5 text-[14px]">
                  {tab === 'open' && r.can.recordFinding ? 'Record a finding' : 'Open'}
                </Button>
              </div>
            </div>
          )}
          columns={columns}
          getRowId={(r) => r.id}
          filters={filters}
          copy={COPY[tab]}
          enabled={ready}
          refreshToken={refresh * 2 + (tab === 'open' ? 0 : 1)}
          searchPlaceholder="Search by number or item"
          onRowActivate={(r) => router.push(href(r.id))}
          fetchRows={async (q) => {
            const range = tab === 'settled' ? effectiveRange(q.filters, SETTLED_DATE, SETTLED_DATE.defaultPreset, nairobiToday()) : undefined;
            const res = await discrepanciesApi.list({ tab, q: q.search || undefined, branchId: q.filters.branchId, departmentId: q.filters.departmentId, from: range?.from, to: range?.to, page: q.page, pageSize: q.perPage as 25 | 50 | 100 });
            setCounts(res.counts);
            setBranches(res.branches);
            return { rows: res.rows, total: res.page.total };
          }}
        />
      </main>
    </div>
  );
}
