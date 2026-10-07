'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { EmptyState, ErrorState } from '@/components/app/shell/shell-states';
import { Topbar } from '@/components/app/shell/topbar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { useLoader } from '../../../_shared/hooks/use-async';
import { useMobileNavDrawer } from '../../../_shared/hooks/use-mobile-nav-drawer';
import { FilterSelect } from '../../_shared/components/filter-select';
import { RunTable } from '../../_shared/components/run-table';
import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import { prepApi } from '../../_shared/services/prep-api';
import { useFilterOptions } from '../../review/hooks/use-filter-options';
import { refreshNeedsLookCount } from '../../review/hooks/use-needs-look-count';
import { KpiStrip } from '../../review/components/kpi-strip';
import { BAND_ROWS, NeedsLookBand } from '../../review/components/needs-look-band';
import { ManagerRunDrawer } from '../../record/components/manager-run-drawer';
import { useRunParam } from '../hooks/use-run-param';
import { PrepHomeLoading } from './prep-home-loading';
import { RunDrawer } from './run-drawer';

const PAGE = 10;

const initialsOf = (name: string | undefined): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  return (parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : parts[0]!.slice(0, 2)).toUpperCase();
};

/**
 * The Runs home for the desktop roles (Paper step 10 `7DL-0`): the week's three figures, the "Needs a look" band, and the latest
 * runs. "New prep run" is there for the roles that hold `prep.record`. A role that reads flags sees the KPI strip, the band, the
 * tint on flagged rows and the "Needs a look only" filter; the figures and money show only what the server sent (`prep.see_costs`).
 *
 * One reload (`reloadAll`) refreshes the strip, the band, the table and the sidebar's badge together; it runs after a run is
 * recorded here and after Mark reviewed in the drawer, so nothing needs a page reload. The open run is `?run=<id>`.
 */
export function ManagerRunsHome({ canRecord, canReadFlags }: { canRecord: boolean; canReadFlags: boolean }) {
  const user = useAuthStore((s) => s.user);
  const { open: openMobileNav } = useMobileNavDrawer();
  const { matches: desktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const { runId, open: openRun, close: closeRun } = useRunParam();
  const options = useFilterOptions();
  const [outputItemId, setOutputItemId] = React.useState<string | undefined>();
  const [needsLookOnly, setNeedsLookOnly] = React.useState(false);
  const [perPage, setPerPage] = React.useState(PAGE);
  const [newRunOpen, setNewRunOpen] = React.useState(false);
  const tableRef = React.useRef<HTMLElement>(null);

  const summary = useLoader(canReadFlags ? 'prep-summary' : null, () => prepApi.runsSummary(), PREP_STATES_COPY.summary.errorTitle);
  const band = useLoader(canReadFlags ? 'prep-needs-look' : null, () => prepApi.needsLook({ perPage: BAND_ROWS }), PREP_STATES_COPY.needsLook.errorTitle);
  const runs = useLoader(
    `prep-runs:${outputItemId ?? ''}:${needsLookOnly}:${perPage}`,
    () => prepApi.listRuns({ outputItemId, needsLook: needsLookOnly || undefined, perPage }),
    PREP_STATES_COPY.runs.errorTitle
  );

  // `reload` of each loader is stable, so this callback is too and the drawer's props do not churn.
  const { reload: reloadSummary } = summary;
  const { reload: reloadBand } = band;
  const { reload: reloadRuns } = runs;
  const reloadAll = React.useCallback(() => {
    void reloadSummary();
    void reloadBand();
    void reloadRuns();
  }, [reloadSummary, reloadBand, reloadRuns]);

  if (!hydrated) return <PrepHomeLoading />;

  const filtered = outputItemId !== undefined || needsLookOnly;
  const clearFilters = (): void => {
    setOutputItemId(undefined);
    setNeedsLookOnly(false);
    setPerPage(PAGE);
  };
  const showAllNeedsLook = (): void => {
    setNeedsLookOnly(true);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const newRun = canRecord ? <Button onClick={() => setNewRunOpen(true)}>New prep run</Button> : null;

  const list = runs.data;
  const table =
    runs.status === 'error' ? (
      <ErrorState title={PREP_STATES_COPY.runs.errorTitle} description={runs.error ?? ''} onRetry={runs.reload} />
    ) : !list ? (
      <div className="flex flex-col gap-wds-2 p-wds-4" aria-busy="true" aria-label="Loading runs">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    ) : list.items.length === 0 ? (
      filtered ? (
        <EmptyState
          title={PREP_STATES_COPY.history.emptyTitle}
          description={PREP_STATES_COPY.history.emptyDescription}
          action={
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <EmptyState title={PREP_STATES_COPY.runs.emptyTitle} description={PREP_STATES_COPY.runs.emptyDescription} />
      )
    ) : (
      <>
        <div className="[&>div]:border-0 [&>div]:border-t [&>div]:border-wds-border">
          <RunTable runs={list.items} variant="manager" onOpen={(r) => openRun(r.id)} />
        </div>
        {list.items.length < list.total ? (
          <div className="flex items-center justify-between border-t border-wds-border px-[18px] py-3">
            <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
              Showing {list.items.length} of {list.total}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setPerPage((n) => n + PAGE)}>
              Show more
            </Button>
          </div>
        ) : null}
      </>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {desktop ? (
        <Topbar breadcrumb={{ root: 'Central Store', section: 'Prep', screen: 'Runs' }} hideSearch className="shrink-0" actions={newRun} />
      ) : (
        <MobileHubHeader title="Prep" subtitle="Runs at the Central Store" userInitials={initialsOf(user?.name)} orgLabel="Hub" onMenuClick={openMobileNav} />
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-wds-5 p-wds-4 lg:px-8 lg:py-7">
          <div className="flex items-start justify-between gap-wds-4">
            <div className="flex flex-col gap-1">
              {desktop ? <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">Prep</h1> : null}
              <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">What has been batched at the Central Store. Anything off shows up here first.</p>
            </div>
            {!desktop ? newRun : null}
          </div>

          {canReadFlags ? <KpiStrip summary={summary.data} status={summary.status === 'error' ? 'error' : summary.data ? 'ready' : 'loading'} onRetry={summary.reload} /> : null}

          {canReadFlags ? (
            <NeedsLookBand
              data={band.data}
              status={band.status === 'error' ? 'error' : band.data ? 'ready' : 'loading'}
              error={band.error}
              onRetry={band.reload}
              onReview={(run) => openRun(run.id)}
              onShowAll={showAllNeedsLook}
            />
          ) : null}

          <section ref={tableRef} aria-label="Recent runs" className="border border-wds-border bg-wds-surface">
            <div className="flex flex-wrap items-center justify-between gap-wds-3 px-[18px] py-3">
              <h2 className="font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-text-ink">Recent runs</h2>
              <div className="flex flex-wrap items-center gap-2">
                <FilterSelect
                  label="Output"
                  allLabel="All outputs"
                  options={options.outputs}
                  value={outputItemId}
                  onChange={(value) => {
                    setOutputItemId(value);
                    setPerPage(PAGE);
                  }}
                  className="h-8 w-[170px]"
                />
                {canReadFlags ? (
                  <button
                    type="button"
                    aria-pressed={needsLookOnly}
                    onClick={() => {
                      setNeedsLookOnly((v) => !v);
                      setPerPage(PAGE);
                    }}
                    className={cn(
                      'h-8 border px-3 font-wds-sans text-wds-body-sm outline-none transition-colors focus-visible:shadow-wds-ring max-sm:h-11',
                      needsLookOnly ? 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg' : 'border-wds-border-strong bg-wds-surface text-wds-text-ink hover:bg-wds-neutral-50'
                    )}
                  >
                    Needs a look only
                  </button>
                ) : null}
                {filtered ? (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : null}
                <Link href="/app/inventory/prep/history" className="ml-2 font-wds-sans text-wds-body-sm font-medium text-wds-espresso-700 outline-none hover:underline focus-visible:shadow-wds-ring max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">
                  View all →
                </Link>
              </div>
            </div>
            {table}
          </section>
        </div>
      </div>
      {canRecord ? (
        <ManagerRunDrawer
          open={newRunOpen}
          onOpenChange={setNewRunOpen}
          onRecorded={() => {
            reloadAll();
            refreshNeedsLookCount(); // a new run can be flagged; the drawer does this itself after Mark reviewed
          }}
        />
      ) : null}
      <RunDrawer runId={runId} onClose={closeRun} onOpenRun={openRun} onChanged={reloadAll} />
    </div>
  );
}
