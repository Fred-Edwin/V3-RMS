'use client';

import { DayCard, EmptyState, ErrorBlock, ListSkeleton, useWorkforcePermissions } from '../../../_shared';
import { nairobiToday } from '../../../rota';
import { useMyRota } from '../../_shared/hooks/use-timesheet-data';
import { rotaLines, rotaRange, rotaSummary } from '../lib/rota-lines';
import { PhoneScreen } from './phone-screen';

/** My rota (Paper Chapter 9, step 1): the next two weeks of my own shifts, today marked. The rota has no publish step, so what I see is what is planned. */
export function MyRotaScreen() {
  const permissions = useWorkforcePermissions();
  const rota = useMyRota(permissions.ready && permissions.can('time.own'));
  const data = rota.data;

  let body: React.ReactNode;
  if (!permissions.ready || rota.status === 'loading') body = <ListSkeleton rows={6} columns={[56, 'fill']} label="Loading your rota" />;
  else if (!permissions.can('time.own')) body = <EmptyState kind="nothingYet" title="You are not on the rota" line="Your shifts appear here when you are on the clock." />;
  else if (rota.status === 'error' && !data) body = <ErrorBlock title="Your rota did not load" line={rota.error.message} onRetry={rota.reload} />;
  else if (!data?.enabled) body = <EmptyState kind="nothingYet" title="Nothing on your rota yet" line="Your shifts appear here once your branch plans them." />;
  else {
    const today = nairobiToday();
    body = (
      <ul aria-label="My shifts" className="m-0 flex list-none flex-col gap-2 p-0">
        {rotaLines(data, today).map((line) => (
          <DayCard key={line.date} day={line.day} today={line.today} dayOff={line.dayOff} shift={line.shift} />
        ))}
      </ul>
    );
  }

  return (
    <PhoneScreen screen="My rota" kicker="MY TIME · ROTA" title={data?.enabled ? rotaRange(data) : 'My rota'} subtitle={data?.enabled ? rotaSummary(data) : undefined} back="/app/workforce/my-time">
      {body}
    </PhoneScreen>
  );
}
