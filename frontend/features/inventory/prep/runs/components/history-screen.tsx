'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Input } from '@/components/ui2/input';
import { SearchInput } from '@/components/ui2/search-input';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/app/shell/shell-states';
import { Topbar } from '@/components/app/shell/topbar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { useLoader } from '../../../_shared/hooks/use-async';
import { useMobileNavDrawer } from '../../../_shared/hooks/use-mobile-nav-drawer';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { FilterSelect } from '../../_shared/components/filter-select';
import { describePrepError } from '../../_shared/lib/prep-errors';
import { saveBlob } from '../../_shared/lib/save-blob';
import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import { prepApi } from '../../_shared/services/prep-api';
import type { PrepRunStatus } from '../../_shared/types/prep-contract';
import { useFilterOptions } from '../../review/hooks/use-filter-options';
import { useHistoryFilters } from '../hooks/use-history-filters';
import { useRunParam } from '../hooks/use-run-param';
import { HISTORY_PER_PAGE, isBackwardsRange, rangeText, toRunsQuery } from '../lib/history-filters';
import { HistoryTable } from './history-table';
import { PrepHomeLoading } from './prep-home-loading';
import { RunDrawer } from './run-drawer';

const label = 'font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-copy-muted';
const field = 'h-[34px]';
const STATUS_OPTIONS: { value: PrepRunStatus; label: string }[] = [
  { value: 'RECORDED', label: 'Recorded' },
  { value: 'CORRECTED', label: 'Corrected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const initialsOf = (name: string | undefined): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  return (parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : parts[0]!.slice(0, 2)).toUpperCase();
};

function Labelled({ text, htmlFor, className, children }: { text: string; htmlFor?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={`${label} mb-1.5 block`}>
        {text}
      </label>
      {children}
    </div>
  );
}

/**
 * Prep history (Paper step 12 `7RR-0`; `/app/inventory/prep/history`). Every run, newest first, with filters (search, output, person,
 * status, from, to), a pager, and Export CSV. Filters live in the URL. The desktop roles see review status and can export; the
 * Store Attendant sees the same table without flags or costs, starting on their own runs (the server sends no flags to them and
 * 403s the export). Paper draws the manager's version only: the Attendant's is built from the same parts.
 */
export function PrepHistoryScreen() {
  // `useSearchParams` (filters and `?run=`) needs a Suspense boundary above it.
  return (
    <React.Suspense fallback={<PrepHomeLoading />}>
      <PrepHistory />
    </React.Suspense>
  );
}

function PrepHistory() {
  const { can, ready, failed } = usePermissions();
  if (!ready && !failed) return <PrepHomeLoading />;
  if (failed || !can('prep.read')) {
    return (
      <div className="flex flex-1 items-center justify-center p-wds-6">
        <PermissionDeniedState description="Prep history is not available for your role." />
      </div>
    );
  }
  return <HistoryBody canReadFlags={can('prep.read_flags')} />;
}

function HistoryBody({ canReadFlags }: { canReadFlags: boolean }) {
  const user = useAuthStore((s) => s.user);
  const { open: openMobileNav } = useMobileNavDrawer();
  const { matches: desktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const defaultMine = !canReadFlags;
  const { filters, update, clear, searchText, setSearchText, active } = useHistoryFilters(defaultMine);
  const { runId, open: openRun, close: closeRun } = useRunParam();
  const options = useFilterOptions();
  const [exporting, setExporting] = React.useState(false);
  const exportBusy = React.useRef(false);

  const backwards = isBackwardsRange(filters);
  const query = toRunsQuery(filters);
  // Keyed on the values, not on `filters`, so opening the drawer (which only changes `?run=`) does not refetch the table.
  const key = backwards ? null : JSON.stringify([query, filters.page]);
  const runs = useLoader(key, () => prepApi.listRuns({ ...query, page: filters.page, perPage: HISTORY_PER_PAGE }), PREP_STATES_COPY.history.errorTitle);

  if (!hydrated) return <PrepHomeLoading />;

  const exportCsv = async (): Promise<void> => {
    if (exportBusy.current) return; // a double click exports once
    exportBusy.current = true;
    setExporting(true);
    try {
      const { blob, fileName } = await prepApi.exportRuns(query);
      saveBlob(blob, fileName);
      useWdsToastStore.getState().addToast({ variant: 'success', title: PREP_STATES_COPY.history.exported, description: fileName });
    } catch (err) {
      useWdsToastStore.getState().addToast({ variant: 'error', title: describePrepError(err, PREP_STATES_COPY.history.exportFailed) });
    } finally {
      exportBusy.current = false;
      setExporting(false);
    }
  };

  const exportButton = canReadFlags ? (
    <Button variant="secondary" disabled={exporting} aria-busy={exporting} onClick={() => void exportCsv()} className="max-sm:h-11">
      {exporting ? 'Exporting…' : 'Export CSV'}
    </Button>
  ) : null;

  const list = runs.data;
  const totalPages = list ? Math.max(1, Math.ceil(list.total / list.perPage)) : 1;
  const range = rangeText(filters);

  const body = backwards ? (
    <EmptyState
      title="The dates are the wrong way round"
      description="“From” is after “To”, so no run can match. Change one of them."
      action={
        <Button variant="secondary" size="sm" onClick={() => update({ from: undefined, to: undefined })}>
          Clear dates
        </Button>
      }
    />
  ) : runs.status === 'error' ? (
    <ErrorState title={PREP_STATES_COPY.history.errorTitle} description={runs.error ?? PREP_STATES_COPY.history.errorDescription} onRetry={runs.reload} />
  ) : list && list.items.length === 0 ? (
    active ? (
      <EmptyState
        title={PREP_STATES_COPY.history.emptyTitle}
        description={PREP_STATES_COPY.history.emptyDescription}
        action={
          <Button variant="secondary" size="sm" onClick={clear}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState title={PREP_STATES_COPY.history.noRunsTitle} description={PREP_STATES_COPY.history.noRunsDescription} />
    )
  ) : (
    <>
      <HistoryTable runs={list?.items ?? null} onOpen={(run) => openRun(run.id)} />
      {list ? (
        <div className="flex flex-wrap items-center justify-between gap-wds-3">
          <p className="m-0 font-wds-sans text-wds-body-sm text-wds-text-copy-muted" aria-live="polite">
            Showing {list.items.length} of {list.total} runs{range ? ` · ${range}` : ''}
            {totalPages > 1 ? ` · Page ${list.page} of ${totalPages}` : ''}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })} className="max-sm:h-11">
              Previous
            </Button>
            <Button variant="secondary" disabled={filters.page >= totalPages} onClick={() => update({ page: filters.page + 1 })} className="max-sm:h-11">
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {desktop ? (
        <Topbar breadcrumb={{ root: 'Central Store', section: 'Prep', sectionHref: '/app/inventory/prep', screen: 'History' }} hideSearch className="shrink-0" actions={exportButton} />
      ) : (
        <MobileHubHeader title="Prep history" subtitle="Every run, newest first" userInitials={initialsOf(user?.name)} orgLabel="Hub" onMenuClick={openMobileNav} />
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-[22px] p-wds-4 lg:p-8">
          <div className="flex items-start justify-between gap-wds-4">
            <div className="flex flex-col gap-1.5">
              {desktop ? <h1 className="font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink">Prep history</h1> : null}
              <p className="m-0 font-wds-sans text-wds-body-sm leading-[18px] text-wds-text-copy-muted">Every prep run, newest first. Corrections and cancellations stay on the record, linked to the run they replace.</p>
            </div>
            {!desktop ? exportButton : null}
          </div>

          <form
            role="search"
            aria-label="Filter prep history"
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => e.preventDefault()}
          >
            <Labelled text="Search" htmlFor="history-search" className="w-full sm:w-[300px]">
              <SearchInput id="history-search" shortcutHint="" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Run number, output or person" className={`${field} w-full border-wds-border-strong`} />
            </Labelled>
            <Labelled text="Output" className="w-[calc(50%-6px)] sm:w-[160px]">
              <FilterSelect label="Output" allLabel="All outputs" options={options.outputs} value={filters.outputItemId} onChange={(value) => update({ outputItemId: value })} className={field} />
            </Labelled>
            {canReadFlags ? (
              <Labelled text="Person" className="w-[calc(50%-6px)] sm:w-[140px]">
                <FilterSelect label="Person" allLabel="Anyone" options={options.people} value={filters.personId} onChange={(value) => update({ personId: value })} className={field} />
              </Labelled>
            ) : null}
            <Labelled text="Status" className="w-[calc(50%-6px)] sm:w-[150px]">
              <FilterSelect label="Status" allLabel="All statuses" options={STATUS_OPTIONS} value={filters.status} onChange={(value) => update({ status: value as PrepRunStatus | undefined })} className={field} />
            </Labelled>
            <Labelled text="From" htmlFor="history-from" className="w-[calc(50%-6px)] sm:w-[140px]">
              <Input id="history-from" type="date" value={filters.from ?? ''} max={filters.to || undefined} onChange={(e) => update({ from: e.target.value || undefined })} className={`${field} font-wds-mono`} aria-invalid={backwards || undefined} />
            </Labelled>
            <Labelled text="To" htmlFor="history-to" className="w-[calc(50%-6px)] sm:w-[140px]">
              <Input id="history-to" type="date" value={filters.to ?? ''} min={filters.from || undefined} onChange={(e) => update({ to: e.target.value || undefined })} className={`${field} font-wds-mono`} aria-invalid={backwards || undefined} />
            </Labelled>
            {!canReadFlags ? (
              <label className="flex h-[34px] cursor-pointer items-center gap-2 font-wds-sans text-wds-body-sm text-wds-text-ink max-sm:h-11">
                <input type="checkbox" checked={filters.mine} onChange={(e) => update({ mine: e.target.checked })} className="size-4 accent-[var(--wds-primary)]" />
                Only my runs
              </label>
            ) : null}
            {active ? (
              <Button type="button" variant="ghost" onClick={clear} className="h-[34px] max-sm:h-11">
                Clear filters
              </Button>
            ) : null}
          </form>

          {body}
        </div>
      </div>
      <RunDrawer runId={runId} onClose={closeRun} onOpenRun={openRun} onChanged={runs.reload} />
    </div>
  );
}
