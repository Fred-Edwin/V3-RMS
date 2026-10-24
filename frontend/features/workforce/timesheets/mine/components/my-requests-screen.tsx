'use client';

import { useRouter } from 'next/navigation';

import { Callout, EmptyState, ErrorBlock, ListSkeleton, PhoneButton, PhoneScreen, PurposeLine, purposeOf, useAction, useWorkforcePermissions } from '../../../_shared';
import { useMyRequests } from '../../_shared/hooks/use-timesheet-data';
import { timesheetWrites } from '../../_shared/services/timesheet-services';
import { RequestCard } from './request-card';

/** My requests (Paper Chapter 9, step 3): a request never disappears. Waiting ones first (with the escalation to HR said in words), then the answered ones. */
export function MyRequestsScreen() {
  const router = useRouter();
  const permissions = useWorkforcePermissions();
  const mine = useMyRequests(permissions.ready && permissions.can('time.own'));
  const withdraw = useAction(() => mine.reload());
  const requests = mine.data?.requests ?? [];
  const waiting = requests.filter((r) => r.state === 'WAITING');
  const rest = requests.filter((r) => r.state !== 'WAITING');

  let body: React.ReactNode;
  if (permissions.failed) body = <ErrorBlock title="We could not load this" line="Your permissions did not load. Nothing was changed." onRetry={permissions.retry} />;
  else if (!permissions.ready) body = <ListSkeleton rows={3} columns={['fill', 90]} label="Loading your requests" />;
  else if (!permissions.can('time.own')) body = <EmptyState kind="nothingYet" title="You do not clock in" line="Requests appear here when you are on the clock." />;
  else if (mine.status === 'loading') body = <ListSkeleton rows={3} columns={['fill', 90]} label="Loading your requests" />;
  else if (mine.status === 'error' && !mine.data) body = <ErrorBlock title="Your requests did not load" line={mine.error.message} onRetry={mine.reload} />;
  else if (requests.length === 0) body = <EmptyState kind="nothingYet" title="No requests yet" line="If a time looks wrong, report it from My time." action={{ label: 'Report a problem', onClick: () => router.push('/app/workforce/my-time/report') }} />;
  else {
    const card = (r: (typeof requests)[number]) => <RequestCard key={r.id} request={r} busy={withdraw.busy} onWithdraw={(id) => void withdraw.run(() => timesheetWrites.withdrawRequest(id))} />;
    body = (
      <>
        {withdraw.error ? (
          <Callout tone="error" size="sm" role="alert">
            {withdraw.error}
          </Callout>
        ) : null}
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {waiting.map(card)}
          {rest.map(card)}
        </ul>
        <PhoneButton kind="outlined" size="sm" onClick={() => router.push('/app/workforce/my-time/report')}>
          Report a problem
        </PhoneButton>
      </>
    );
  }

  return (
    <PhoneScreen screen="My requests" kicker="MY REQUESTS" back="/app/workforce/my-time">
      <PurposeLine>{purposeOf('/app/workforce/my-time/requests')}</PurposeLine>
      {body}
    </PhoneScreen>
  );
}
