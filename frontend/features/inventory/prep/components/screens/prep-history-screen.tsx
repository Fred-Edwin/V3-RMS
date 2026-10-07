'use client';

import * as React from 'react';

import { StatusDot, type StatusTone } from '@/components/ui2/status-dot';
import { SearchInput } from '@/components/ui2/search-input';
import { Topbar } from '@/components/app/shell/topbar';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { EmptyState, ErrorState } from '@/components/app/shell/shell-states';
import { MobileEmptyState, MobileErrorState } from '@/components/app/shell/mobile-states';
import { PrepHistorySkeletonDesktop, PrepHistorySkeletonMobile, PrepKpiSkeletonDesktop } from '../../../_shared/components/skeletons';
import { KpiStrip, KpiRow } from '../../../_shared/components/kpi-strip';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { useMobileNavDrawer } from '../../../_shared/hooks/use-mobile-nav-drawer';
import { usePrepRunsList } from '../../hooks/use-prep-runs-list';
import { usePrepSummary } from '../../hooks/use-prep-summary';
import { PrepRunDetailDrawer } from './prep-run-detail-screen';
import type { PrepRunSummary, YieldFlagFilter } from '../../types/prep';

const YIELD_FLAG_OPTIONS: { value: YieldFlagFilter | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low yield' },
  { value: 'high', label: 'High yield' },
];

/** "12 Sep 07:20" — no comma, matching Paper's `ZZQ-0` WHEN column exactly (a comma pushes this to two lines at the column's real width). */
function formatWhen(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const datePart = parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const timePart = parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart}`;
}

/** "+0.5L · normal" / "-5L · low yield" — same convention as the runs list's VsAverageCell (`prep-runs-list-screen.tsx`), kept in sync since both screens share this column design. */
function YieldVarianceCell({ run }: { run: PrepRunSummary }) {
  const label =
    !run.yieldVarianceLabel || run.yieldVarianceLabel === 'normal'
      ? 'normal'
      : run.yieldVarianceLabel === 'low yield'
        ? 'low yield'
        : 'high yield';
  const tone: StatusTone = label === 'normal' ? 'neutral' : 'warning';
  return (
    <StatusDot tone={tone}>
      {run.yieldVarianceDelta ? `${run.yieldVarianceDelta}${run.yieldUnit} · ` : ''}
      {label}
    </StatusDot>
  );
}

/**
 * Prep History — screen 4 (desktop `ZZQ-0` / mobile `10AN-0`). Structural
 * copy of `HistoryListScreen`'s pattern (search + filters + sticky-header
 * table on desktop, card list on mobile, pagination) — not a redesign. Own
 * KPI summary strip (Runs in range / Total input cost / Yield flags) scoped
 * to the active filter's dateFrom/dateTo.
 */
export function PrepHistoryScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const { open: openMobileNav } = useMobileNavDrawer();
  const user = useAuthStore((s) => s.user);
  const { rows, filters, setFilters, hasMore, loadingMore, loadMore, status, error, reload } = usePrepRunsList();
  const { summary } = usePrepSummary(filters.dateFrom, filters.dateTo);
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);

  // Sourced from the current result page, not a separate items fetch — good
  // enough for a filter dropdown scoped to "outputs that have actually been
  // prepped," which is the only set relevant to this screen.
  const outputOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) seen.set(r.outputItemId, r.outputName);
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  if (!hydrated) return null;

  const kpiCells = [
    { key: 'runs', label: 'Runs in range', value: summary ? String(summary.runsInRange) : '—' },
    { key: 'value', label: 'Total input cost', value: summary ? `KES ${Number(summary.totalInputCost).toLocaleString()}` : '—' },
    {
      key: 'flags',
      label: 'Yield flags',
      value: summary ? String(summary.yieldFlagCount) : '—',
      tone: summary && summary.yieldFlagCount > 0 ? ('warning' as const) : ('ink' as const),
    },
  ];

  if (!isDesktop) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader
          title="Prep History"
          subtitle="All recorded prep runs"
          userInitials={user?.name ? user.name.slice(0, 2).toUpperCase() : 'JM'}
          onMenuClick={openMobileNav}
        />
        <div className="flex min-h-0 flex-1 flex-col gap-wds-3 overflow-y-auto p-wds-4">
          <KpiRow cells={kpiCells} />
          <SearchInput
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Search output or attendant"
          />
          <div className="flex gap-wds-2 overflow-x-auto">
            {YIELD_FLAG_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, yieldFlag: opt.value }))}
                className={`shrink-0 rounded-wds-full border px-wds-3 py-1 font-wds-sans text-wds-caption ${
                  filters.yieldFlag === opt.value
                    ? 'border-wds-primary bg-wds-primary text-wds-primary-fg'
                    : 'border-wds-border bg-wds-surface text-wds-text-copy-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {status === 'loading' || status === 'idle' ? (
            <PrepHistorySkeletonMobile />
          ) : status === 'error' ? (
            <MobileErrorState title="Couldn't load prep history" description={error ?? 'Try again.'} onRetry={reload} />
          ) : rows.length === 0 ? (
            <MobileEmptyState title="No prep runs found" description="Try adjusting your filters." />
          ) : (
            <>
              {rows.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedRunId(run.id)}
                  className="flex flex-col gap-wds-1 rounded-wds-md border border-wds-border bg-wds-surface p-wds-3 text-left"
                >
                  <div className="flex items-center justify-between gap-wds-2">
                    <span className="truncate font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{run.outputName}</span>
                    <span className="shrink-0 font-wds-mono text-wds-caption text-wds-text-copy-muted">{formatWhen(run.when)}</span>
                  </div>
                  <span className="truncate font-wds-sans text-wds-caption text-wds-text-copy-muted" title={run.inputsPreview.firstItemLabel}>
                    {run.inputsPreview.firstItemLabel}
                    {run.inputsPreview.remainingCount > 0 ? ` +${run.inputsPreview.remainingCount} more` : ''}
                  </span>
                  <div className="flex items-center justify-between gap-wds-2">
                    <span className="font-wds-mono text-wds-body-sm text-wds-text-ink">
                      {run.actualYield}
                      {run.yieldUnit}
                    </span>
                    <YieldVarianceCell run={run} />
                  </div>
                </button>
              ))}
              {hasMore ? (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex h-9 items-center justify-center rounded-wds-sm font-wds-sans text-wds-caption font-medium text-wds-caramel-600 outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring disabled:pointer-events-none disabled:opacity-60"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              ) : null}
            </>
          )}
        </div>
        <PrepRunDetailDrawer runId={selectedRunId} open={selectedRunId !== null} onOpenChange={(open) => !open && setSelectedRunId(null)} variant="mobile" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: 'Prep', sectionHref: '/app/inventory/prep', screen: 'History' }} className="shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col gap-wds-4 overflow-y-auto px-8 py-7">
        <div className="flex items-center justify-between gap-wds-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">Prep History</h1>
            <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">All recorded prep runs — search by output or attendant, filter by date or yield flag.</p>
          </div>
        </div>

        {summary ? <KpiStrip cells={kpiCells} /> : <PrepKpiSkeletonDesktop />}

        <div className="flex flex-wrap items-center gap-wds-2">
          <SearchInput
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Search output, attendant…"
            className="w-[280px]"
          />
          <select
            value={filters.outputItemId ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, outputItemId: e.target.value || undefined }))}
            className="h-8 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2 font-wds-sans text-wds-caption text-wds-text-ink"
          >
            <option value="">Output</option>
            {outputOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select
            value={filters.yieldFlag ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, yieldFlag: (e.target.value || undefined) as YieldFlagFilter | undefined }))}
            className="h-8 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2 font-wds-sans text-wds-caption text-wds-text-ink"
          >
            <option value="">Yield flag</option>
            {YIELD_FLAG_OPTIONS.filter((o) => o.value).map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.dateFrom ? filters.dateFrom.slice(0, 10) : ''}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined }))}
            className="h-8 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2 font-wds-mono text-wds-caption text-wds-text-ink"
          />
          <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">–</span>
          <input
            type="date"
            value={filters.dateTo ? filters.dateTo.slice(0, 10) : ''}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined }))}
            className="h-8 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2 font-wds-mono text-wds-caption text-wds-text-ink"
          />
          {filters.search || filters.outputItemId || filters.yieldFlag || filters.dateFrom || filters.dateTo ? (
            <button
              type="button"
              onClick={() => setFilters({ search: '' })}
              className="ml-auto font-wds-sans text-wds-caption font-medium text-wds-caramel-600"
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {status === 'loading' || status === 'idle' ? (
          <PrepHistorySkeletonDesktop />
        ) : status === 'error' ? (
          <div className="flex flex-1 items-center justify-center">
            <ErrorState title="Couldn't load prep history" description={error ?? 'Try again.'} onRetry={reload} />
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
            {rows.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-10">
                <EmptyState title="No prep runs found" description="Try adjusting your filters." />
              </div>
            ) : (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="sticky top-0 z-10 flex h-[34px] w-full shrink-0 items-center border-b border-wds-text-ink bg-wds-surface px-wds-4">
                  <span className="basis-[11%] shrink-0 whitespace-nowrap font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">When</span>
                  <span className="basis-[16%] shrink-0 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Output</span>
                  <span className="grow basis-[24%] font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Inputs</span>
                  <span className="basis-[8%] shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Yield</span>
                  <span className="basis-[16%] shrink-0 pl-5 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Vs average</span>
                  <span className="basis-[15%] shrink-0 whitespace-nowrap text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Unit cost</span>
                  <span className="basis-[6%] shrink-0 pl-4 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">By</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {rows.map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => setSelectedRunId(run.id)}
                      className="flex h-12 w-full shrink-0 items-center border-b border-wds-neutral-100 px-wds-4 text-left transition-colors last:border-b-0 hover:bg-wds-neutral-50"
                    >
                      <span className="basis-[11%] shrink-0 whitespace-nowrap font-wds-mono text-wds-caption text-wds-text-copy-muted">{formatWhen(run.when)}</span>
                      <span className="basis-[16%] shrink-0 truncate pr-2 font-wds-sans text-wds-body-sm font-medium text-wds-text-ink" title={run.outputName}>
                        {run.outputName}
                      </span>
                      <span className="grow basis-[24%] min-w-0 truncate pr-4 font-wds-sans text-wds-body-sm text-wds-text-ink" title={run.inputsPreview.firstItemLabel}>
                        {run.inputsPreview.firstItemLabel}
                        {run.inputsPreview.remainingCount > 0 ? (
                          <span className="text-wds-text-faint"> +{run.inputsPreview.remainingCount} more</span>
                        ) : null}
                      </span>
                      <span className="basis-[8%] shrink-0 whitespace-nowrap text-right font-wds-mono text-wds-body-sm text-wds-text-ink">
                        {run.actualYield}
                        {run.yieldUnit}
                      </span>
                      <span className="basis-[16%] shrink-0 pl-5">
                        <YieldVarianceCell run={run} />
                      </span>
                      <span className="basis-[15%] shrink-0 whitespace-nowrap text-right font-wds-mono text-wds-body-sm text-wds-text-ink">
                        KES {run.outputUnitCost}/{run.yieldUnit}
                      </span>
                      <span className="basis-[6%] shrink-0 whitespace-nowrap text-right font-wds-mono text-wds-caption text-wds-text-copy-muted">
                        {run.createdByInitials}
                      </span>
                    </button>
                  ))}
                  {hasMore ? (
                    <div className="flex h-11 items-center justify-center">
                      <button
                        type="button"
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="font-wds-sans text-wds-caption font-medium text-wds-caramel-600 disabled:opacity-60"
                      >
                        {loadingMore ? 'Loading…' : 'Load more'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <PrepRunDetailDrawer runId={selectedRunId} open={selectedRunId !== null} onOpenChange={(open) => !open && setSelectedRunId(null)} variant="desktop" />
    </div>
  );
}
