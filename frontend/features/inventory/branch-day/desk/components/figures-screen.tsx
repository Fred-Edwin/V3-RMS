'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Skeleton } from '@/components/ui2/skeleton';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { RefLink } from '../../../_shared/components/block2-phone-parts';
import { useLoader } from '../../../_shared/hooks/use-async';
import { BRANCH_DAY_STATES_COPY } from '../../_shared/lib/branch-day-copy';
import type { DepartmentFigures } from '../../_shared/types/branch-day-contract';
import { useDayAccess, useDayBase } from '../hooks/use-day-access';
import { dayPaths } from '../lib/desk-paths';
import { clock12, longDay } from '../lib/desk-format';
import { branchDayDeskApi } from '../services/branch-day-desk-api';
import { DayTopbar } from './day-topbar';
import { DepartmentRail, DepartmentSelect, FiguresTable, PaneFacts } from './department-pane';

/**
 * Block 4, desktop: a department's figures (Paper B6), opened from "Open figures →" on Today. Two panes: the department rail with its
 * Used value and the branch total (money only with `catalog.see_costs`), and the selected department's table. The selected department and
 * the day live in the URL (`?day=&dept=`). Live for an open day, frozen for a closed one.
 */
export function FiguresScreen() {
  const access = useDayAccess();
  if (access.failed) return <ScwStatePanel kind="error" text={BRANCH_DAY_STATES_COPY.figures.error} className="m-8" />;
  if (!access.ready) return <FiguresSkeleton />;
  if (access.view === 'none') return <ScwStatePanel kind="permission" text={BRANCH_DAY_STATES_COPY.today.permission} className="m-8" />;
  return <FiguresView everyBranch={access.view === 'all'} seesMoney={access.seesMoney} />;
}

function FiguresSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-hidden="true">
      <LoadingAnnouncer text={BRANCH_DAY_STATES_COPY.figures.loading} />
      <div className="h-14 shrink-0 border-b border-wds-border bg-wds-gradient-topbar" />
      <div className="flex flex-col gap-2 px-8 pt-7">
        <Skeleton className="h-[30px] w-48" />
        <Skeleton className="h-[18px] w-72" />
      </div>
      <div className="mx-8 mt-5 flex min-h-[400px] border-t border-wds-text-ink">
        <div className="hidden w-[272px] shrink-0 flex-col gap-3 border-r border-wds-text-ink p-4 lg:flex">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <div className="flex grow flex-col gap-3 px-6 py-5">
          <Skeleton className="h-6 w-40" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

function FiguresView({ everyBranch, seesMoney }: { everyBranch: boolean; seesMoney: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const base = useDayBase();
  const paths = dayPaths(base);
  const dayId = params.get('day');
  const deptParam = params.get('dept');
  const branchId = params.get('branch') ?? undefined;

  // Without a department in the address, open the first one of today's day.
  const first = useLoader(dayId && !deptParam ? `first:${dayId}` : null, async () => (await branchDayDeskApi.today({ branchId })).day?.departments[0]?.departmentId ?? null, BRANCH_DAY_STATES_COPY.figures.error);
  const deptId = deptParam ?? first.data;
  const figures = useLoader<DepartmentFigures>(dayId && deptId ? `figures:${dayId}:${deptId}` : null, () => branchDayDeskApi.figures(dayId ?? '', deptId ?? ''), BRANCH_DAY_STATES_COPY.figures.error);

  const crumb = { root: everyBranch ? 'Branches' : 'Branch', section: 'Day', sectionHref: paths.today(branchId), screen: figures.data?.department.name ?? '…' };
  if (!dayId || first.status === 'error' || figures.status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DayTopbar breadcrumb={crumb} />
        <ScwStatePanel kind={dayId ? 'error' : 'empty'} text={dayId ? BRANCH_DAY_STATES_COPY.figures.error : 'Open a department from Today to see its figures.'} onRetry={dayId ? () => { void figures.reload(); void first.reload(); } : undefined} className="m-8" />
      </div>
    );
  }
  const data = figures.data;
  if (!data) return <FiguresSkeleton />;

  const { department } = data;
  const hrefFor = (id: string): string => paths.figures(dayId, id, branchId);
  const countedBy = department.countedBy ? (department.onBehalf ? `${department.countedBy.name} on behalf of the department` : department.countedBy.name) : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DayTopbar breadcrumb={crumb} />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 pb-10 pt-7">
        <div className="mb-5 flex flex-col gap-1">
          <h1 tabIndex={-1} className="m-0 font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink outline-none">
            Today’s figures
          </h1>
          <p className="m-0 font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">
            {data.branch.name} · {longDay(data.day.date)} · <RefLink reference={data.day.reference} href={paths.today(everyBranch ? data.branch.id : undefined)} className="text-[14px]" />
          </p>
        </div>
        <div className="flex min-h-[420px] grow border-t border-wds-text-ink">
          <DepartmentRail rail={data.rail} selectedId={department.id} hrefFor={hrefFor} showMoney={seesMoney && data.branchUsedValueKes !== undefined} branchTotal={data.branchUsedValueKes} />
          <section aria-label={`${department.name} figures`} className="flex min-w-0 grow flex-col">
            <DepartmentSelect rail={data.rail} selectedId={department.id} onSelect={(id) => router.replace(hrefFor(id), { scroll: false })} />
            <div className="flex flex-col gap-4 px-6 py-5" aria-busy={figures.status === 'loading'}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <h2 className="m-0 font-wds-sans text-[18px] font-semibold leading-6 text-wds-text-ink">{department.name}</h2>
                  <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
                    {department.state === 'COUNTED' && department.countedAt ? `Counted by ${countedBy} at ${clock12(department.countedAt)} · signed with PIN` : 'Has not counted yet. The closing figures appear when it does.'}
                  </p>
                </div>
                <PaneFacts figures={department} />
              </div>
              <FiguresTable figures={department} showMoney={seesMoney && department.totals !== undefined} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
