'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { EmptyState, ErrorState } from '@/components/app/shell/shell-states';
import { Topbar } from '@/components/app/shell/topbar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { useLoader } from '../../../_shared/hooks/use-async';
import { useMobileNavDrawer } from '../../../_shared/hooks/use-mobile-nav-drawer';
import { PrepAgainTile } from '../../_shared/components/prep-again-tile';
import { VsUsualChip } from '../../_shared/components/run-chips';
import { RunTable } from '../../_shared/components/run-table';
import { formatDayAndClock, formatQuantity, formatWhen } from '../../_shared/lib/prep-format';
import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import { prepApi } from '../../_shared/services/prep-api';
import type { RunSummary } from '../../_shared/types/prep-contract';
import { useRunParam } from '../hooks/use-run-param';
import { PrepHomeLoading } from './prep-home-loading';
import { RunDrawer } from './run-drawer';

const NEW_RUN = '/app/inventory/prep/new';
const HISTORY = '/app/inventory/prep/history';
const FIX_WINDOW_MS = 24 * 60 * 60 * 1000;

const initialsOf = (name: string | undefined): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  return (parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : parts[0]!.slice(0, 2)).toUpperCase();
};

/** "12 Oct 07:20 · SA · yours, can fix until tomorrow 07:20" (Paper step 35). */
function runMeta(run: RunSummary, now: number): string {
  const parts = [formatWhen(run.at), run.by.initials];
  if (run.mine) {
    const ends = new Date(run.at).getTime() + FIX_WINDOW_MS;
    parts.push(run.status === 'RECORDED' && ends > now ? `yours, can fix until ${formatDayAndClock(new Date(ends).toISOString())}` : 'yours');
  }
  return parts.join(' · ');
}

function RecentRunRow({ run, now, onOpen }: { run: RunSummary; now: number; onOpen: (run: RunSummary) => void }) {
  return (
    <li className="border-b border-wds-border last:border-b-0">
      <button type="button" onClick={() => onOpen(run)} className="flex w-full items-start justify-between gap-wds-3 px-wds-4 py-wds-3 text-left outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-wds-sans text-wds-body font-medium text-wds-text-ink">{run.outputName}</span>
          <span className={cn('font-wds-mono text-[11px] leading-[14px]', run.mine ? 'text-wds-espresso-600' : 'text-wds-text-copy-muted')}>{runMeta(run, now)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="font-wds-sans text-wds-body text-wds-text-ink">
            {formatQuantity(run.made)} {run.unit}
          </span>
          <VsUsualChip vsUsual={run.vsUsual} className="text-wds-caption" />
        </span>
      </button>
    </li>
  );
}

/**
 * The Store Attendant's Prep home (Paper steps 1, 35, 36): "Prep again" tiles for the three most-made items, "+ Something else",
 * and Recent runs. A phone stacks it under the dark hub header; a tablet puts the tiles three across; a computer puts the tiles
 * and Recent runs side by side. No costs, no flags: the server sends none to this role.
 */
export function AttendantHome() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { open: openMobileNav } = useMobileNavDrawer();
  const { matches: desktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const again = useLoader('prep-again', () => prepApi.prepAgain().then((r) => r.tiles), PREP_STATES_COPY.home.errorTitle);
  const recent = useLoader('prep-recent', () => prepApi.listRuns({ perPage: desktop ? 8 : 5 }).then((r) => r.items), PREP_STATES_COPY.recentRuns.errorTitle);
  const { runId, open: openRun, close: closeRun } = useRunParam();
  const [now] = React.useState(() => Date.now());

  if (!hydrated) return <PrepHomeLoading />;
  const goPrep = (itemId: string): void => router.push(`${NEW_RUN}?item=${encodeURIComponent(itemId)}`);

  const tiles =
    again.status === 'error' ? (
      <ErrorState title={PREP_STATES_COPY.home.errorTitle} description={again.error ?? PREP_STATES_COPY.home.errorDescription} onRetry={again.reload} />
    ) : again.status !== 'ready' ? (
      <div className="flex flex-col gap-wds-3 sm:grid sm:grid-cols-3 lg:flex lg:flex-col" aria-busy="true" aria-label="Loading Prep again">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[72px] w-full sm:h-[122px] lg:h-[72px]" />
        ))}
      </div>
    ) : (again.data ?? []).length === 0 ? (
      <EmptyState title={PREP_STATES_COPY.prepAgain.emptyTitle} description={PREP_STATES_COPY.prepAgain.emptyDescription} />
    ) : (
      <>
        <div className="flex flex-col gap-wds-3 sm:hidden lg:flex">
          {(again.data ?? []).map((t) => (
            <PrepAgainTile key={t.itemId} tile={t} onPrep={goPrep} layout="row" />
          ))}
        </div>
        <div className="hidden gap-wds-3 sm:grid sm:grid-cols-3 lg:hidden">
          {(again.data ?? []).map((t) => (
            <PrepAgainTile key={t.itemId} tile={t} onPrep={goPrep} layout="card" />
          ))}
        </div>
      </>
    );

  const somethingElse = (
    <Link
      href={NEW_RUN}
      className="flex h-12 items-center justify-center border border-wds-border-strong bg-wds-surface font-wds-sans text-wds-body text-wds-text-ink outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
    >
      + Something else · New prep run
    </Link>
  );

  const recentBlock = (
    <section aria-label="Recent runs" className="flex flex-col gap-wds-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">Recent runs</h2>
        <Link href={HISTORY} className="font-wds-sans text-wds-body-sm text-wds-espresso-700 outline-none hover:underline focus-visible:shadow-wds-ring">
          View all →
        </Link>
      </div>
      {recent.status === 'error' ? (
        <ErrorState title={PREP_STATES_COPY.recentRuns.errorTitle} description={recent.error ?? ''} onRetry={recent.reload} />
      ) : recent.status !== 'ready' ? (
        <div className="flex flex-col gap-wds-2" aria-busy="true" aria-label="Loading recent runs">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (recent.data ?? []).length === 0 ? (
        <EmptyState title={PREP_STATES_COPY.recentRuns.emptyTitle} description={PREP_STATES_COPY.recentRuns.emptyDescription} />
      ) : desktop ? (
        <>
          <RunTable runs={recent.data ?? []} variant="attendant" onOpen={(r) => openRun(r.id)} />
          <p className="font-wds-sans text-wds-caption text-wds-text-copy-muted">Runs marked “yours” can be corrected or cancelled for 24 hours. Other runs open to read only.</p>
        </>
      ) : (
        <ul className="border border-wds-border bg-wds-surface">
          {(recent.data ?? []).map((r) => (
            <RecentRunRow key={r.id} run={r} now={now} onOpen={(run) => openRun(run.id)} />
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
      {desktop ? (
        <Topbar breadcrumb={{ root: 'Central Store', section: 'Prep', screen: 'Runs' }} hideSearch className="shrink-0" />
      ) : (
        <>
          <div className="sm:hidden">
            <MobileHubHeader title="Prep" subtitle="Batched at the Central Store" userInitials={initialsOf(user?.name)} orgLabel="Hub" onMenuClick={openMobileNav} />
          </div>
          <header className="hidden h-14 shrink-0 items-center gap-wds-3 bg-wds-sidebar-mid px-wds-5 sm:flex">
            <button type="button" onClick={openMobileNav} aria-label="Open menu" className="flex size-8 items-center justify-center rounded-wds-sm outline-none focus-visible:shadow-wds-ring">
              <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
                <path d="M1 1H17M1 7H17M1 13H17" fill="none" stroke="var(--wds-sidebar-fg-item)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <span className="flex-1 font-wds-mono text-wds-field-label uppercase tracking-[0.08em] text-wds-caramel">Wendo RMS · Hub</span>
            <span aria-hidden className="flex size-[30px] items-center justify-center rounded-full bg-wds-espresso-800 font-wds-mono text-wds-field-label text-[#EBDFD6]">
              {initialsOf(user?.name)}
            </span>
          </header>
        </>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-wds-5 p-wds-4 sm:p-wds-6 lg:px-8 lg:py-7">
          <div className={cn('flex-col gap-1', desktop ? 'flex' : 'hidden sm:flex')}>
            <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">Prep</h1>
            <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{desktop ? 'Batched at the Central Store. Tap Prep to record a run, filled in as last time.' : 'Batched at the Central Store'}</p>
          </div>
          {/* minmax(0,1fr) so long text truncates inside its column instead of widening the page on a phone. */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-wds-5 lg:grid-cols-[minmax(0,492px)_minmax(0,1fr)] lg:gap-8">
            <section aria-label="Prep again" className="flex flex-col gap-wds-3">
              <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-copy-muted">Prep again</span>
              {tiles}
              {somethingElse}
            </section>
            {recentBlock}
          </div>
        </div>
      </div>
      <RunDrawer runId={runId} onClose={closeRun} onOpenRun={openRun} />
    </div>
  );
}
