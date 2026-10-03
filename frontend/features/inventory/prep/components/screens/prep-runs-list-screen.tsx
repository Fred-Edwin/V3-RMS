'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { StatusDot, type StatusTone } from '@/components/ui2/status-dot';
import { Topbar } from '@/components/app/shell/topbar';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { EmptyState, ErrorState } from '@/components/app/shell/shell-states';
import { MobileEmptyState, MobileErrorState } from '@/components/app/shell/mobile-states';
import { KpiStrip, KpiRow } from '../../../_shared/components/kpi-strip';
import { PrepKpiSkeletonDesktop, PrepRunsListSkeletonDesktop, PrepRunsListSkeletonMobile } from '../../../_shared/components/skeletons';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { useMobileNavDrawer } from '../../../_shared/hooks/use-mobile-nav-drawer';
import { usePrepRunsList } from '../../hooks/use-prep-runs-list';
import { usePrepSummary } from '../../hooks/use-prep-summary';
import { NewPrepRunDrawer } from './new-prep-run-screen';
import { PrepRunDetailDrawer } from './prep-run-detail-screen';
import type { PrepRunSummary, YieldVarianceLabel } from '../../types/prep';

const yieldToneMap: Record<Exclude<YieldVarianceLabel, 'normal'>, StatusTone> = {
  'low yield': 'warning',
  'high yield': 'warning',
};

/** "12 Sep 07:20" — no comma, matching Paper's `Z61-0` WHEN column exactly (a comma pushes this to two lines at the column's real width). */
function formatWhen(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const datePart = parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const timePart = parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart}`;
}

/** "6kg chicken +2 more" — the "+N more" truncated-inputs convention (04-components.md's Milestone Three section), a one-off treatment, not a shared component. */
function InputsPreviewCell({ run }: { run: PrepRunSummary }) {
  return (
    <span className="block truncate font-wds-sans text-wds-body-sm text-wds-text-ink" title={run.inputsPreview.firstItemLabel}>
      {run.inputsPreview.firstItemLabel}
      {run.inputsPreview.remainingCount > 0 ? (
        <span className="text-wds-text-faint"> +{run.inputsPreview.remainingCount} more</span>
      ) : null}
    </span>
  );
}

/** "+0.5 L · normal" / "-5 L · low yield" — matches Paper's `Z61-0` VS AVERAGE column exactly (dot + delta + label together, not a separate "Normal" fallback). */
function VsAverageCell({ run }: { run: PrepRunSummary }) {
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
 * Prep runs list — screen 1 (desktop `Z61-0` / mobile `ZGY-0`). KpiStrip's 3
 * tiles + a table (desktop) / card list (mobile) of recent runs, each
 * opening the detail drawer/route. "New prep run" is this screen's primary
 * action.
 */
export function PrepRunsListScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const { open: openMobileNav } = useMobileNavDrawer();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { rows, hasMore, loadingMore, loadMore, status, error, reload } = usePrepRunsList();
  const { summary, reload: reloadSummary } = usePrepSummary();
  const [newRunOpen, setNewRunOpen] = React.useState(false);
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);

  const goToHistory = () => router.push('/app/inventory/prep/history');
  const goToDetail = (id: string) => setSelectedRunId(id);
  const handleRunRecorded = () => {
    setNewRunOpen(false);
    void reload();
    void reloadSummary();
  };
  // "Flagged only" (Z61-0) means "not normal" — the backend's yieldFlag filter
  // takes one value at a time (normal/low/high), so this toggle is a
  // client-side filter over this screen's own preview batch rather than a
  // server round-trip; Prep History's dedicated Low/High chips cover the
  // server-filtered case for the full ledger.
  const [flaggedOnly, setFlaggedOnly] = React.useState(false);
  const [outputFilter, setOutputFilter] = React.useState('');
  const outputOptions = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.outputName))).sort(),
    [rows],
  );
  const visibleRows = rows.filter(
    (r) =>
      (!flaggedOnly || (r.yieldVarianceLabel && r.yieldVarianceLabel !== 'normal')) &&
      (!outputFilter || r.outputName === outputFilter),
  );

  if (!hydrated) return null;

  const kpiCells = [
    { key: 'runs', label: 'Runs this week', value: summary ? String(summary.runsInRange) : '—' },
    {
      key: 'flags',
      label: 'Yield flags',
      value: summary ? String(summary.yieldFlagCount) : '—',
      tone: summary && summary.yieldFlagCount > 0 ? ('warning' as const) : ('ink' as const),
    },
    {
      key: 'value',
      label: 'Prep value',
      value: summary ? `KES ${Number(summary.totalInputCost).toLocaleString()}` : '—',
    },
  ];

  if (!isDesktop) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader
          title="Prep"
          subtitle="Record what was prepped"
          userInitials={user?.name ? user.name.slice(0, 2).toUpperCase() : 'JM'}
          onMenuClick={openMobileNav}
        />
        <div className="flex min-h-0 flex-1 flex-col gap-wds-4 overflow-y-auto p-wds-4">
          <KpiRow cells={kpiCells} />
          <Button onClick={() => setNewRunOpen(true)} className="w-full">
            New prep run
          </Button>
          {status === 'loading' || status === 'idle' ? (
            <PrepRunsListSkeletonMobile />
          ) : status === 'error' ? (
            <MobileErrorState title="Couldn't load prep runs" description={error ?? 'Try again.'} onRetry={reload} />
          ) : rows.length === 0 ? (
            <MobileEmptyState title="No prep runs yet" description="Record your first prep run to see it here." />
          ) : (
            <>
              {rows.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => goToDetail(run.id)}
                  className="flex flex-col gap-wds-1 rounded-wds-md border border-wds-border bg-wds-surface p-wds-3 text-left"
                >
                  <div className="flex items-center justify-between gap-wds-2">
                    <span className="truncate font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{run.outputName}</span>
                    <span className="shrink-0 font-wds-mono text-wds-caption text-wds-text-copy-muted">{formatWhen(run.when)}</span>
                  </div>
                  <InputsPreviewCell run={run} />
                  <div className="flex items-center justify-between gap-wds-2">
                    <span className="font-wds-mono text-wds-body-sm text-wds-text-ink">
                      {run.actualYield}
                      {run.yieldUnit}
                    </span>
                    <VsAverageCell run={run} />
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
              <button
                type="button"
                onClick={goToHistory}
                className="flex h-9 items-center justify-center font-wds-sans text-wds-caption font-medium text-wds-caramel-600"
              >
                View full history
              </button>
            </>
          )}
        </div>
        <NewPrepRunDrawer open={newRunOpen} onOpenChange={setNewRunOpen} onRunRecorded={handleRunRecorded} variant="mobile" />
        <PrepRunDetailDrawer runId={selectedRunId} open={selectedRunId !== null} onOpenChange={(open) => !open && setSelectedRunId(null)} variant="mobile" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ section: 'Central Store', screen: 'Prep' }}
        actions={<Button onClick={() => setNewRunOpen(true)}>New prep run</Button>}
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">Prep</h1>
          <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            What&apos;s been batched at the Central Store — recorded after the fact. Yield is compared to the rolling average, never validated against it.
          </p>
        </div>

        {summary ? <KpiStrip cells={kpiCells} /> : <PrepKpiSkeletonDesktop />}

        {status === 'loading' || status === 'idle' ? (
          <PrepRunsListSkeletonDesktop />
        ) : status === 'error' ? (
          <div className="flex flex-1 items-center justify-center">
            <ErrorState title="Couldn't load prep runs" description={error ?? 'Try again.'} onRetry={reload} />
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
            <div className="flex h-10 shrink-0 items-center gap-wds-2 border-b border-wds-border px-wds-4">
              <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">Recent runs</span>
              <div className="ml-auto flex items-center gap-wds-3">
                <div className="flex gap-wds-1.5">
                  <select
                    value={outputFilter}
                    onChange={(e) => setOutputFilter(e.target.value)}
                    className="rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2 py-0.5 font-wds-sans text-wds-caption text-wds-text-ink"
                  >
                    <option value="">Output</option>
                    {outputOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setFlaggedOnly((v) => !v)}
                    className={`rounded-wds-sm border px-wds-2 py-0.5 font-wds-sans text-wds-caption ${
                      flaggedOnly ? 'border-wds-primary bg-wds-primary text-wds-primary-fg' : 'border-wds-border-strong bg-wds-surface text-wds-text-ink'
                    }`}
                  >
                    Flagged only
                  </button>
                </div>
                <div className="h-3.5 w-px shrink-0 bg-wds-border" />
                <button type="button" onClick={goToHistory} className="font-wds-sans text-wds-caption font-medium text-wds-caramel-600">
                  View all →
                </button>
              </div>
            </div>
            {visibleRows.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-10">
                <EmptyState title="No prep runs yet" description="Record your first prep run to see it here." />
              </div>
            ) : (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="sticky top-0 z-10 flex h-[30px] w-full shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-4">
                  <span className="basis-[11%] shrink-0 whitespace-nowrap font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">When</span>
                  <span className="basis-[16%] shrink-0 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Output</span>
                  <span className="grow basis-[24%] font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Inputs</span>
                  <span className="basis-[8%] shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Yield</span>
                  <span className="basis-[16%] shrink-0 pl-5 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Vs average</span>
                  <span className="basis-[15%] shrink-0 whitespace-nowrap text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Unit cost</span>
                  <span className="basis-[6%] shrink-0 pl-4 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">By</span>
                  <span className="w-[16px] shrink-0" />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {visibleRows.map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => goToDetail(run.id)}
                      className="flex h-12 w-full shrink-0 items-center border-b border-wds-neutral-100 px-wds-4 text-left transition-colors last:border-b-0 hover:bg-wds-neutral-50"
                    >
                      <span className="basis-[11%] shrink-0 whitespace-nowrap font-wds-mono text-wds-caption text-wds-text-copy-muted">{formatWhen(run.when)}</span>
                      <span className="basis-[16%] shrink-0 truncate pr-2 font-wds-sans text-wds-body-sm font-medium text-wds-text-ink" title={run.outputName}>
                        {run.outputName}
                      </span>
                      <span className="grow basis-[24%] min-w-0 pr-4">
                        <InputsPreviewCell run={run} />
                      </span>
                      <span className="basis-[8%] shrink-0 whitespace-nowrap text-right font-wds-mono text-wds-body-sm text-wds-text-ink">
                        {run.actualYield}
                        {run.yieldUnit}
                      </span>
                      <span className="basis-[16%] shrink-0 pl-5">
                        <VsAverageCell run={run} />
                      </span>
                      <span className="basis-[15%] shrink-0 whitespace-nowrap text-right font-wds-mono text-wds-body-sm text-wds-text-ink">
                        KES {run.outputUnitCost}/{run.yieldUnit}
                      </span>
                      <span className="basis-[6%] shrink-0 whitespace-nowrap pl-4 font-wds-mono text-wds-caption text-wds-text-copy-muted">
                        {run.createdByInitials}
                      </span>
                      <span className="w-[16px] shrink-0 font-wds-sans text-wds-body text-wds-text-faint">›</span>
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
      <NewPrepRunDrawer open={newRunOpen} onOpenChange={setNewRunOpen} onRunRecorded={handleRunRecorded} variant="desktop" />
      <PrepRunDetailDrawer runId={selectedRunId} open={selectedRunId !== null} onOpenChange={(open) => !open && setSelectedRunId(null)} variant="desktop" />
    </div>
  );
}
