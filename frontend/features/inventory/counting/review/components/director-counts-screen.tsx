'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { DataTable, type TableColumn } from '@/components/ui2/data-table/data-table';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { ScwKpiStrip, ScwKpiStripSkeleton } from '../../../_shared/components/scw-kpi-strip';
import { ScwStatePanel } from '../../../_shared/components/scw-states';
import { ScwTopbar } from '../../../_shared/components/scw-topbar';
import { useLoader } from '../../../_shared/hooks/use-async';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { dayMonthClockLabel, signedMoney, signedQty } from '../../_shared/lib/count-format';
import { COUNT_ERROR_COPY, COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import type { CountRow, FlaggedLine, RepeatShortfallList } from '../../_shared/types/counting-contract';
import { CountSettingsDrawer } from '../../setup/components/count-settings-drawer';
import { COUNTS, makeCountColumns } from './counts-columns';

type Tab = '' | 'all' | 'repeat';

const FILTERS: TableFilter[] = [
  {
    kind: 'chips',
    key: 'tab',
    options: [
      { value: '', label: 'Flagged to me' },
      { value: 'all', label: 'All counts' },
      { value: 'repeat', label: 'Repeat shortfalls' },
    ],
  },
];

const COPY = {
  emptyTitle: 'Nothing flagged',
  emptyDescription: COUNTING_STATES_COPY.directorCounts.empty,
  filteredEmptyTitle: 'Nothing matches',
  filteredEmptyDescription: 'Nothing matches this search. Clear it to see everything.',
  errorTitle: 'Could not load counts',
  errorDescription: 'Try again. Nothing was changed.',
  permissionDescription: COUNTING_STATES_COPY.directorCounts.permission,
};

/**
 * The Director's Counts (Paper step 26, `21YA-0`; `/stock/counts?view=flagged`): what was flagged to them, with the Manager's cause
 * for each, and "Mark seen" (the Director's only write besides the alert amount; shown only when the row's `can.markSeen` says so).
 * Chips switch between Flagged to me, All counts and Repeat shortfalls. "Count settings" opens the alert-amount drawer (step 45).
 * Everything else is read only, and the page says so.
 */
export function DirectorCountsScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { can, ready } = usePermissions();
  const tab = (params.get('tab') ?? '') as Tab;
  const summary = useLoader('counts-summary-director', () => countingApi.summary('director'), COUNTING_STATES_COPY.directorCounts.error);
  const [refresh, setRefresh] = React.useState(0);
  const [marking, setMarking] = React.useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(params.get('drawer') === 'settings');
  const chipCounts = React.useRef<Record<string, Record<string, number>>>({ tab: {} });
  const [counts, setCounts] = React.useState<Record<string, Record<string, number>>>({ tab: {} });

  const markSeen = React.useCallback(
    async (line: FlaggedLine): Promise<void> => {
      if (marking) return;
      setMarking(line.lineId);
      try {
        await countingApi.markSeen([line.lineId]);
        setRefresh((n) => n + 1);
        void summary.reload();
      } catch (err) {
        useWdsToastStore.getState().addToast({ variant: 'error', title: scwErrorMessage(err, COUNT_ERROR_COPY, 'Could not mark it seen. Try again.') });
      } finally {
        setMarking(null);
      }
    },
    [marking, summary],
  );

  const flaggedColumns = React.useMemo<TableColumn<FlaggedLine>[]>(
    () => [
      { id: 'count', header: 'Count', width: '140px', cell: (r) => <span className="font-wds-mono text-[12px] leading-4 text-wds-text-ink">{r.countReference}</span> },
      { id: 'item', header: 'Item', width: '220px', cell: (r) => <span className={r.seenAt ? 'text-wds-text-secondary' : 'font-medium text-wds-text-ink'}>{r.itemName}</span> },
      { id: 'difference', header: 'Difference', width: '130px', align: 'right', cell: (r) => <span className="font-wds-mono text-wds-error-fg">{signedQty(r.difference, r.unit)}</span> },
      { id: 'value', header: 'Value', width: '100px', align: 'right', cell: (r) => <span className="font-wds-mono text-wds-error-fg">{signedMoney(r.differenceValueKes)}</span> },
      { id: 'cause', header: 'Cause', width: '170px', className: 'pl-6', cell: (r) => <span className="text-wds-text-ink">{r.causeText}</span> },
      { id: 'by', header: 'Counted by', width: '160px', cell: (r) => <span className="text-wds-text-ink">{r.countedBy.name}</span> },
      {
        id: 'status',
        header: 'Status',
        align: 'right',
        cell: (r) =>
          r.can.markSeen ? (
            <Button
              variant="secondary"
              className="h-[30px] border-wds-text-ink px-3.5 font-semibold text-wds-text-ink"
              disabled={marking === r.lineId}
              onClick={(e) => {
                e.stopPropagation();
                void markSeen(r);
              }}
            >
              {marking === r.lineId ? 'Marking…' : 'Mark seen'}
              <span className="sr-only"> {r.itemName} in {r.countReference}</span>
            </Button>
          ) : (
            <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{r.seenAt ? `Seen${r.seenBy ? ` by ${r.seenBy.name.split(' ')[0]}` : ''} · ${dayMonthClockLabel(r.seenAt)}` : 'Not seen yet'}</span>
          ),
      },
    ],
    [marking, markSeen],
  );

  const repeatColumns = React.useMemo<TableColumn<RepeatShortfallList['rows'][number]>[]>(
    () => [
      { id: 'item', header: 'Item', width: '240px', cell: (r) => <span className="font-medium text-wds-text-ink">{r.itemName}</span> },
      { id: 'section', header: 'Section', width: '160px', cell: (r) => <span className="text-wds-text-secondary">{r.sectionName ?? 'No section'}</span> },
      { id: 'runs', header: 'Short in a row', width: '130px', align: 'right', cell: (r) => <span className="font-wds-mono text-wds-warning-fg">{r.shortRuns} counts</span> },
      { id: 'last', header: 'Last counts', className: 'pl-6', cell: (r) => <span className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{r.lastCounts.map((c) => `${c.countReference} ${signedQty(c.difference, r.unit)}`).join(' · ')}</span> },
    ],
    [],
  );

  const countColumns = React.useMemo(() => makeCountColumns((href) => router.push(href)), [router]);

  if (ready && !can('counts.read')) return <ScwStatePanel kind="permission" text={COUNTING_STATES_COPY.directorCounts.permission} className="m-8" />;

  const common = { enabled: ready, filters: FILTERS, copy: COPY, searchPlaceholder: 'Search' } as const;
  const setCountsFrom = (c: { flaggedToMe: number; allCounts: number; repeatShortfalls: number }): void => {
    const next = { tab: { '': c.flaggedToMe, all: c.allCounts, repeat: c.repeatShortfalls } };
    chipCounts.current = next;
    setCounts((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScwTopbar
        search={false}
        breadcrumb={{ section: 'Central Store', screen: 'Counts' }}
        actions={
          <>
            <span className="mr-2 hidden font-wds-sans text-[12px] leading-4 text-wds-text-secondary xl:inline">You can read everything here. Only the Manager changes counts.</span>
            {can('counts.set_director_alert') ? (
              <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
                Count settings
              </Button>
            ) : null}
          </>
        }
      />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-mobile-title tracking-tight text-wds-text-ink">Counts</h1>
          <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">Every count, with what was flagged to you.</p>
        </div>
        {summary.data ? (
          <ScwKpiStrip
            cells={summary.data.kpis}
            activeFilter={tab === 'repeat' ? 'repeat' : tab === '' ? 'flagged' : ''}
            onFilter={(f) => {
              const q = new URLSearchParams(params.toString());
              if (f === 'repeat') q.set('tab', 'repeat');
              else q.delete('tab');
              q.delete('page');
              router.replace(`${COUNTS}?${q}`, { scroll: false });
            }}
          />
        ) : summary.status === 'error' ? null : (
          <ScwKpiStripSkeleton />
        )}

        {tab === 'all' ? (
          <DataTable<CountRow>
            key="all"
            label="All counts"
            columns={countColumns}
            getRowId={(r) => r.id}
            {...common}
            counts={counts}
            onRowActivate={(r) => router.push(`${COUNTS}/${r.id}`)}
            fetchRows={async (q, { signal }) => {
              const res = await countingApi.list({ search: q.search || undefined, page: q.page, pageSize: q.perPage as 25 | 50 | 100 }, signal);
              const f = await countingApi.flagged({ page: 1, pageSize: 25 });
              setCountsFrom(f.chips);
              return { rows: res.rows, total: res.page.total };
            }}
          />
        ) : tab === 'repeat' ? (
          <DataTable<RepeatShortfallList['rows'][number]>
            key="repeat"
            label="Repeat shortfalls"
            columns={repeatColumns}
            getRowId={(r) => r.itemId}
            {...common}
            counts={counts}
            fetchRows={async (_q, { signal }) => {
              const res = await countingApi.repeatShortfalls({ page: _q.page, pageSize: _q.perPage }, signal);
              setCountsFrom(res.chips);
              return { rows: res.rows, total: res.page.total };
            }}
          />
        ) : (
          <DataTable<FlaggedLine>
            key="flagged"
            label="Flagged lines"
            columns={flaggedColumns}
            getRowId={(r) => r.lineId}
            {...common}
            counts={counts}
            refreshToken={refresh}
            rowClassName={(r) => (r.seenAt ? 'bg-wds-neutral-50' : undefined)}
            onRowActivate={(r) => router.push(`${COUNTS}/${r.countId}`)}
            fetchRows={async (q, { signal }) => {
              const res = await countingApi.flagged({ page: q.page, pageSize: q.perPage }, signal);
              setCountsFrom(res.chips);
              return { rows: res.rows, total: res.page.total };
            }}
          />
        )}
      </main>
      <CountSettingsDrawer
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) void summary.reload();
        }}
      />
    </div>
  );
}
