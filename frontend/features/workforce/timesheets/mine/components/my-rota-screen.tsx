'use client';

import { DayCard, EmptyState, ErrorBlock, ListSkeleton, PhoneScreen, useWorkforcePermissions } from '../../../_shared';
import { nairobiToday } from '../../../rota';
import { useMyRota } from '../../_shared/hooks/use-timesheet-data';
import { rotaLines, rotaRange, rotaSummary } from '../lib/rota-lines';

/** My rota (Paper Chapter 9, step 1): the next two weeks of my own shifts, today marked. The rota has no publish step, so what I see is what is planned. */
export function MyRotaScreen() {
  const permissions = useWorkforcePermissions();
  const rota = useMyRota(permissions.ready && permissions.can('time.own'));
  const data = rota.data;

  let body: React.ReactNode;
  if (permissions.failed) body = <ErrorBlock title="We could not load this" line="Your permissions did not load. Nothing was changed." onRetry={permissions.retry} />;
  else if (!permissions.ready) body = <ListSkeleton rows={6} columns={[56, 'fill']} label="Loading your shifts" />;
  else if (!permissions.can('time.own')) body = <EmptyState kind="nothingYet" title="You do not clock in" line="Your shifts appear here when you are on the clock." />;
  else if (rota.status === 'loading') body = <ListSkeleton rows={6} columns={[56, 'fill']} label="Loading your shifts" />;
  else if (rota.status === 'error' && !data) body = <ErrorBlock title="Your shifts did not load" line={rota.error.message} onRetry={rota.reload} />;
  else if (!data?.enabled) body = <EmptyState kind="nothingYet" title="No shifts yet" line="Your shifts appear here once your branch plans them." />;
  else {
    const today = nairobiToday();
    body = (
      <ul aria-label="My shifts" className="m-0 flex list-none flex-col gap-2 p-0">
        {rotaLines(data, today).map((line) => (
          <DayCard key={line.date} day={line.day} today={line.today} dayOff={line.dayOff} dayOffLabel={line.notPlanned ? 'Not planned yet' : 'Day off'} shift={line.shift} />
        ))}
      </ul>
    );
  }

  return (
    <PhoneScreen screen="My shifts" kicker="MY TIME · SHIFTS" title={data?.enabled ? `My shifts · ${rotaRange(data)}` : 'My shifts'} subtitle={data?.enabled ? rotaSummary(data) : undefined} back="/app/workforce/my-time">
      {body}
    </PhoneScreen>
  );
}
