'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { EmptyState, ErrorBlock, ListSkeleton, PhoneScreen, useRemote } from '../../../../_shared';
import { useOnline } from '../../../_shared/hooks/use-online';
import { LEAVE_LOADING } from '../../../_shared/lib/leave-ui';
import { leaveToast } from '../../../_shared/lib/leave-toast';
import { MY_LEAVE, myLeaveFollowHref } from '../../../_shared/lib/leave-routes';
import { leaveReads } from '../../../_shared/services/leave-services';
import { RequestForm } from './request-form';

/** Ask for leave on a phone (and for a desktop role that opens the link): a thin dark bar and the form. */
export function RequestScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const online = useOnline();
  const overview = useRemote(() => leaveReads.overview(), 'request-overview');
  const data = overview.data;

  let body: React.ReactNode;
  if (overview.status === 'loading') body = <ListSkeleton rows={4} columns={['fill', 60]} label={LEAVE_LOADING} />;
  else if (!data) body = <ErrorBlock title="Leave did not load" line="Nothing was changed. Check your connection and try again." onRetry={overview.reload} />;
  else if (data.casual || !data.onPolicy || data.chips.length === 0) body = <EmptyState kind="nothingYet" title={data.message ?? 'No leave is set up for you yet. Ask HR.'} />;
  else {
    body = (
      <RequestForm
        chips={data.chips}
        initial={{ typeCode: search.get('type') ?? undefined, start: search.get('start') ?? undefined, end: search.get('end') ?? undefined }}
        online={online}
        onOpenExisting={(id) => router.push(myLeaveFollowHref(id))}
        onSent={(result, sentTo) => {
          leaveToast(`Sent to ${sentTo}.`);
          router.replace(myLeaveFollowHref(result.application.id));
        }}
      />
    );
  }
  return (
    <PhoneScreen screen="Ask for leave" kicker="ASK FOR LEAVE" back={MY_LEAVE} desktopTitle="Ask for leave">
      {body}
    </PhoneScreen>
  );
}
