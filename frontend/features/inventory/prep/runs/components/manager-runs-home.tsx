'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { SearchInput } from '@/components/ui2/search-input';
import { Skeleton } from '@/components/ui2/skeleton';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { EmptyState, ErrorState } from '@/components/app/shell/shell-states';
import { Topbar } from '@/components/app/shell/topbar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { useLoader } from '../../../_shared/hooks/use-async';
import { useMobileNavDrawer } from '../../../_shared/hooks/use-mobile-nav-drawer';
import { RunTable } from '../../_shared/components/run-table';
import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import { prepApi } from '../../_shared/services/prep-api';
import { ManagerRunDrawer } from '../../record/components/manager-run-drawer';
import { PrepHomeLoading } from './prep-home-loading';
import { PrepRunDetailDrawer } from '../../components/screens/prep-run-detail-screen';

const PAGE = 25;

const initialsOf = (name: string | undefined): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  return (parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : parts[0]!.slice(0, 2)).toUpperCase();
};

/**
 * The Runs home for the desktop roles (Paper step 41 shows its shell): a plain list of runs, with "New prep run" for the roles that
 * hold `prep.record` (Store Manager, System Admin). Read-only roles see the same list without the button. Columns follow the role:
 * Unit cost only when the server sent it (`prep.see_costs`).
 *
 * Slice 4 seam: the KPI strip (runs this week, needs a look, prep value) and the "Needs a look" band render between the title and
 * the table below, and the table gains the status and review columns. Nothing is stubbed here.
 */
export function ManagerRunsHome({ canRecord }: { canRecord: boolean }) {
  const user = useAuthStore((s) => s.user);
  const { open: openMobileNav } = useMobileNavDrawer();
  const { matches: desktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const [search, setSearch] = React.useState('');
  const [term, setTerm] = React.useState('');
  const [perPage, setPerPage] = React.useState(PAGE);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [openRunId, setOpenRunId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setTerm(search.trim());
      setPerPage(PAGE);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const runs = useLoader(`prep-runs:${term}:${perPage}`, () => prepApi.listRuns({ search: term || undefined, perPage }), PREP_STATES_COPY.runs.errorTitle);

  if (!hydrated) return <PrepHomeLoading />;

  const newRun = canRecord ? (
    <Button onClick={() => setDrawerOpen(true)}>New prep run</Button>
  ) : null;

  const list = runs.data;
  const content =
    runs.status === 'error' ? (
      <ErrorState title={PREP_STATES_COPY.runs.errorTitle} description={runs.error ?? ''} onRetry={runs.reload} />
    ) : !list ? (
      <div className="flex flex-col gap-wds-2" aria-busy="true" aria-label="Loading runs">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    ) : list.items.length === 0 ? (
      term ? (
        <EmptyState title={PREP_STATES_COPY.runs.filteredEmptyTitle} description={PREP_STATES_COPY.runs.filteredEmptyDescription} action={<Button variant="secondary" size="sm" onClick={() => setSearch('')}>Clear search</Button>} />
      ) : (
        <EmptyState title={PREP_STATES_COPY.runs.emptyTitle} description={PREP_STATES_COPY.runs.emptyDescription} />
      )
    ) : (
      <>
        <RunTable runs={list.items} variant="manager" onOpen={(r) => setOpenRunId(r.id)} />
        <div className="flex items-center justify-between">
          <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
            Showing {list.items.length} of {list.total}
          </span>
          {list.items.length < list.total ? (
            <Button variant="secondary" size="sm" onClick={() => setPerPage((n) => n + PAGE)}>
              Show more
            </Button>
          ) : null}
        </div>
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

          {/* Slice 4 seam: KPI strip and "Needs a look" band go here. */}

          <section aria-label="Recent runs" className="flex flex-col gap-wds-3">
            <div className="flex flex-wrap items-center justify-between gap-wds-3">
              <h2 className="font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">Recent runs</h2>
              <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search run, item or person" aria-label="Search runs" className="w-full sm:w-[280px]" />
            </div>
            {content}
          </section>
        </div>
      </div>
      {canRecord ? <ManagerRunDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onRecorded={() => runs.reload()} /> : null}
      <PrepRunDetailDrawer runId={openRunId} open={openRunId !== null} onOpenChange={(open) => !open && setOpenRunId(null)} variant={desktop ? 'desktop' : 'mobile'} />
    </div>
  );
}
