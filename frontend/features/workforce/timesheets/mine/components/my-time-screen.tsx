'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Callout, EmptyState, ErrorBlock, ListSkeleton, PeriodStepper, PhoneButton, PhoneScreen, TimeRow, useWorkforcePermissions } from '../../../_shared';
import { useMyTime } from '../../_shared/hooks/use-timesheet-data';
import { hm, monthOf } from '../../_shared/lib/timesheet-words';
import { heroLine, overtimeLine, weekGroups } from '../lib/my-view';

/**
 * My time (Paper Chapter 9, step 1): the hours worked this month, then each day with its clock times and where it stands. A day that
 * looks wrong carries a red bar and "Report a problem"; a branch still on the old clock sees a plain note and nothing else. Overtime is
 * shown as authorised or waiting; nothing here is pay.
 */
export function MyTimeScreen() {
  const router = useRouter();
  const permissions = useWorkforcePermissions();
  const [periodId, setPeriodId] = React.useState<string | undefined>(undefined);
  const time = useMyTime(periodId, permissions.ready && permissions.can('time.own'));
  const data = time.data;
  const period = data?.period ?? null;
  const periods = data?.periods ?? [];
  const at = period ? periods.findIndex((p) => p.id === period.id) : -1;

  let body: React.ReactNode;
  if (permissions.failed) body = <ErrorBlock title="We could not load this" line="Your permissions did not load. Nothing was changed." onRetry={permissions.retry} />;
  else if (!permissions.ready) body = <ListSkeleton rows={5} columns={[44, 'fill', 60]} label="Loading your time" />;
  else if (!permissions.can('time.own')) body = <EmptyState kind="nothingYet" title="You do not clock in" line="Your time appears here when you are on the clock." />;
  else if (time.status === 'loading') body = <ListSkeleton rows={5} columns={[44, 'fill', 60]} label="Loading your time" />;
  else if (time.status === 'error' && !data) body = <ErrorBlock title="Your time did not load" line={time.error.message} onRetry={time.reload} />;
  else if (!data?.enabled || !period) body = <EmptyState kind="nothingYet" title="Your branch still uses the old clock" line="My time appears here once your branch switches to the new clock." />;
  else {
    const groups = weekGroups(data, period);
    const note = overtimeLine(data);
    body = (
      <>
        {periods.length > 1 ? (
          <PeriodStepper label={monthOf(period)} previousLabel="Earlier month" nextLabel="Later month" previousDisabled={at < 0 || at >= periods.length - 1} nextDisabled={at <= 0} onPrevious={() => setPeriodId(periods[at + 1]?.id)} onNext={() => setPeriodId(periods[at - 1]?.id)} />
        ) : null}
        {note ? (
          <Callout tone="info" size="sm" title="Overtime">
            {note}
          </Callout>
        ) : null}
        {groups.length === 0 ? <EmptyState kind="nothingYet" title="No days yet this month" line="Your days appear here as you work them." /> : null}
        {groups.map((group) => (
          <section key={group.weekStart} aria-label={group.label} className="flex flex-col gap-2">
            <h2 className="m-0 mt-1 font-wds-mono text-[10px] font-normal uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">{group.label}</h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {group.lines.map((line) => (
                <TimeRow
                  key={line.key}
                  day={line.day}
                  range={line.range}
                  hours={line.hours}
                  state={line.state}
                  note={line.note}
                  report={line.reportable ? { label: 'Report a problem', onClick: () => router.push(`/app/workforce/my-time/report?date=${line.date}`) } : undefined}
                />
              ))}
            </ul>
          </section>
        ))}
        <div className="mt-2 flex flex-col gap-2.5">
          <PhoneButton kind="outlined" size="sm" onClick={() => router.push('/app/workforce/my-time/report')}>
            Report a problem
          </PhoneButton>
          <PhoneButton kind="outlined" size="sm" onClick={() => router.push('/app/workforce/my-time/requests')}>
            {data.openRequests > 0 ? `My requests · ${data.openRequests} waiting` : 'My requests'}
          </PhoneButton>
          <PhoneButton kind="outlined" size="sm" onClick={() => router.push('/app/workforce/my-time/rota')}>
            My shifts
          </PhoneButton>
        </div>
      </>
    );
  }

  const heroReady = data?.enabled && period;
  return (
    <PhoneScreen
      screen="My time"
      kicker={period ? `MY TIME · ${monthOf(period).toUpperCase()}` : 'MY TIME'}
      figure={heroReady ? hm(data.totals.workedMinutes) : undefined}
      title={heroReady ? undefined : 'My time'}
      subtitle={heroReady ? heroLine(data, monthOf(period)) : undefined}
      back="/app/workforce"
    >
      {body}
    </PhoneScreen>
  );
}
