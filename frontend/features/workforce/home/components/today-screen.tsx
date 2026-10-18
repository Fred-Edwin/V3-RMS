'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';

import { ChoiceChips, EmptyState, ErrorBlock, ListSkeleton, PageHeader, PeriodStepper, WorkforceFrame, WorkforceKpiStrip, useRemote, useWorkforcePermissions } from '../../_shared';
import { attendanceReads, kpiCells, liveLine, useBoard } from '../../attendance';
import { addDays, nairobiToday } from '../../rota';
import { LiveBoard } from './live-board';

const longDay = (date: string): string => new Date(`${date}T12:00:00+03:00`).toLocaleDateString('en-GB', { timeZone: 'Africa/Nairobi', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/**
 * The Today board on its own page, `/app/workforce/today` (Paper Chapter 7 step 1, plus a date to look back and everyone rostered). The
 * numbers, "Needs a look", the departments and everyone, for the branch the viewer may read: their own, or any branch for a company-wide
 * role (a branch picker appears). A branch still on the old clock says so and shows nothing else.
 */
export function TodayScreen() {
  const permissions = useWorkforcePermissions();
  const params = useSearchParams();
  const today = nairobiToday();
  const [date, setDate] = React.useState(() => {
    const asked = params.get('date');
    return asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today;
  });
  const [siteId, setSiteId] = React.useState<string | undefined>(undefined);
  const user = useAuthStore((s) => s.user);
  const wide = permissions.scopeOf('today.read') === 'all';
  const sites = useRemote(() => attendanceReads.switches(), 'today-sites', permissions.ready && wide);
  // A company-wide role with no branch of their own starts on the first branch that uses the new clock.
  const chosen = siteId ?? (wide ? (sites.data?.find((s) => s.enabled)?.organizationId ?? user?.organizationId ?? undefined) : undefined);
  const ready = permissions.ready && (!wide || sites.data !== null || sites.status === 'error');
  const board = useBoard(date, chosen, date === today, ready && permissions.can('today.read'));
  const review = params.get('review');
  const reviewEmployee = params.get('employee');

  const body = !permissions.ready || board.status === 'loading' ? (
    <ListSkeleton rows={6} columns={[160, 'fill', 100]} label="Loading the Today board" />
  ) : board.status === 'error' && !board.data ? (
    <ErrorBlock title="The board did not load" line={board.error.message} onRetry={board.reload} />
  ) : board.data && !board.data.enabled ? (
    <EmptyState kind="nothingYet" title="This branch still uses the old clock" line="The Today board appears here once the Director switches the new clock on for this branch." />
  ) : board.data ? (
    <>
      <WorkforceKpiStrip aria-label="The branch on this day" cells={kpiCells(board.data)} />
      <LiveBoard board={board.data} reload={board.reload} everyone initialReview={review && reviewEmployee ? { employeeId: reviewEmployee, entryId: review, date: params.get('date') ?? date } : undefined} />
    </>
  ) : null;

  const siteName = sites.data?.find((s) => s.organizationId === chosen)?.organizationName ?? user?.organizationName ?? 'the branch';
  return (
    <WorkforceFrame breadcrumb={{ section: 'Workforce', screen: 'Today board' }} phoneTitle="Today board" label="Today board" className="px-4 py-6 lg:px-8 lg:py-7">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
        <PageHeader
          title={`Today at ${siteName}`}
          subtitle={board.data?.enabled ? liveLine(board.data, date === today) : undefined}
          actions={<PeriodStepper label={longDay(date)} previousLabel="Previous day" nextLabel="Next day" onPrevious={() => setDate(addDays(date, -1))} onNext={() => setDate(addDays(date, 1))} nextDisabled={date >= today} />}
        />
        {wide && sites.data && sites.data.length > 1 ? (
          <ChoiceChips legend="Branch" legendStyle="caps" size="sm" value={chosen ?? null} onChange={setSiteId} options={sites.data.map((s) => ({ value: s.organizationId, label: s.organizationName }))} />
        ) : null}
        {body}
      </div>
    </WorkforceFrame>
  );
}
