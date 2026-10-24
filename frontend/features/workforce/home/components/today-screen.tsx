'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

import { TopbarBell } from '@/components/app/shell/menu/topbar-bell';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';

import { ChoiceChips, ErrorBlock, ListSkeleton, PageHeader, WorkforceFrame, WorkforceKpiStrip, purposeOf, useRemote, useWorkforcePermissions } from '../../_shared';
import { CLOCK_OFF_LINE, attendanceReads, clockOffCopy, kpiCells, liveLine, useBoard, type Board } from '../../attendance';
import { useOpenNotifications, useUnreadStore } from '../../notifications';
import { addDays, nairobiToday } from '../../rota';
import { ClockOffCard } from './clock-off-card';
import { LiveBoard } from './live-board';
import { DayPicker, PastDayTag, shortDay } from './past-day-parts';
import { PhoneKpis } from './phone-board';

/** The line under the title: the clock-off line, the day-is-over line the server words, or the live line. */
function subtitleOf(board: Board | null, date: string, today: string): string | undefined {
  if (!board) return undefined;
  if (!board.clock.on) return CLOCK_OFF_LINE;
  if (board.pastDay) return board.pastDay.line;
  return liveLine(board, date === today);
}

/**
 * The Today board on its own page, `/app/workforce/today` (Paper Chapter 7 step 1, plus Schedule V1 frames 2.1 to 2.4). The numbers,
 * "Needs a look", the departments and everyone, for the branch the viewer may read: their own, or any branch for a company-wide role (a
 * branch picker appears). A branch whose clock is off shows "Not tracked" and the card that says why and what to do; a day that is over
 * shows that day's exceptions, read only; a phone gets the stacked cards. A department head sees their own team ("Barista team today").
 */
export function TodayScreen() {
  const permissions = useWorkforcePermissions();
  const params = useSearchParams();
  const today = nairobiToday();
  const phone = useMediaQuery('(max-width: 767px)').matches;
  const [date, setDate] = React.useState(() => {
    const asked = params.get('date');
    return asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today;
  });
  const [siteId, setSiteId] = React.useState<string | undefined>(undefined);
  const user = useAuthStore((s) => s.user);
  const unread = useUnreadStore((s) => s.unread);
  const openNotifications = useOpenNotifications();
  const wide = permissions.scopeOf('today.read') === 'all';
  const sites = useRemote(() => attendanceReads.switches(), 'today-sites', permissions.ready && wide);
  // A company-wide role with no branch of their own starts on the first branch that uses the new clock, else the first branch (its board says the clock is off).
  const chosen = siteId ?? (wide ? (sites.data?.find((s) => s.enabled)?.organizationId ?? user?.organizationId ?? sites.data?.[0]?.organizationId ?? undefined) : undefined);
  const ready = permissions.ready && (!wide || sites.data !== null || sites.status === 'error');
  const board = useBoard(date, chosen, date === today, ready && permissions.can('today.read'));
  const review = params.get('review');
  const reviewEmployee = params.get('employee');
  const data = board.data;

  const siteName = sites.data?.find((s) => s.organizationId === chosen)?.organizationName ?? data?.clock.organizationName ?? user?.organizationName ?? 'the branch';

  let body: React.ReactNode;
  if (!permissions.ready || board.status === 'loading') {
    body = <ListSkeleton rows={6} columns={[160, 'fill', 100]} label="Loading the Today board" />;
  } else if (board.status === 'error' && !data) {
    body = <ErrorBlock title="The board did not load" line={board.error.message} reference={board.error.reference} onRetry={board.reload} />;
  } else if (data && !data.clock.on) {
    body = (
      <>
        {phone ? <PhoneKpis cells={kpiCells(data)} /> : <WorkforceKpiStrip aria-label="The branch on this day" cells={kpiCells(data)} />}
        <ClockOffCard copy={clockOffCopy(data, siteName)} />
      </>
    );
  } else if (data) {
    body = (
      <>
        {phone ? <PhoneKpis cells={kpiCells(data)} /> : <WorkforceKpiStrip aria-label="The branch on this day" cells={kpiCells(data)} />}
        <LiveBoard
          board={data}
          reload={board.reload}
          everyone={!phone && !data.pastDay}
          phone={phone}
          initialReview={review && reviewEmployee ? { employeeId: reviewEmployee, entryId: review, date: params.get('date') ?? date } : undefined}
        />
      </>
    );
  }

  // A department head sees their own team: the page is "Barista team today", under Department, not the branch's Today board.
  const isHead = permissions.scopeOf('today.read') === 'dept';
  const teamName = data?.departments[0]?.name;
  const pageName = isHead ? 'Team today' : 'Today board';
  const place = isHead ? (teamName ? `${teamName} team` : 'Team') : siteName;
  const past = date < today;
  const title = past ? (
    <span className="flex flex-wrap items-center gap-3">
      {`${shortDay(date)} at ${place}`}
      {data?.pastDay ? <PastDayTag>{data.pastDay.tag}</PastDayTag> : null}
    </span>
  ) : isHead ? (
    teamName ? `${teamName} team today` : 'Team today'
  ) : (
    `Today at ${siteName}`
  );
  return (
    <WorkforceFrame
      breadcrumb={{ section: isHead ? 'Department' : 'Workforce', screen: pageName }}
      phoneTitle={isHead ? pageName : 'Today'}
      label={pageName}
      actions={<TopbarBell href="/app/workforce/notifications" unread={unread} onClick={openNotifications} />}
      className="px-4 py-6 lg:px-8 lg:py-7"
    >
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
        <PageHeader
          title={title}
          purpose={purposeOf('/app/workforce/today')}
          subtitle={subtitleOf(data, date, today)}
          actions={<DayPicker date={date} onPrevious={() => setDate(addDays(date, -1))} onNext={() => setDate(addDays(date, 1))} nextDisabled={date >= today} onToday={past ? () => setDate(today) : undefined} />}
        />
        {wide && sites.data && sites.data.length > 1 ? (
          <ChoiceChips legend="Branch" legendStyle="caps" size="sm" value={chosen ?? null} onChange={setSiteId} options={sites.data.map((s) => ({ value: s.organizationId, label: s.organizationName }))} />
        ) : null}
        {body}
      </div>
    </WorkforceFrame>
  );
}
