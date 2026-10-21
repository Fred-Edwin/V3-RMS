'use client';

import Link from 'next/link';

import { useAuthStore } from '@/store/authStore';

import { Callout, EmptyState, ErrorBlock, ListSkeleton, PhoneScreen, useRemote } from '../../../../_shared';
import { LeaveCard, LeaveLegend } from '../../../_shared/components/leave-card';
import { useOnline } from '../../../_shared/hooks/use-online';
import { waitingOn } from '../../../_shared/lib/leave-copy';
import { rangeShort } from '../../../_shared/lib/leave-dates';
import { LEAVE_LOADING, LEAVE_LOAD_FAILED, NO_CONNECTION } from '../../../_shared/lib/leave-ui';
import { MY_LEAVE_HISTORY, MY_LEAVE_REQUEST, myLeaveFollowHref } from '../../../_shared/lib/leave-routes';
import { leaveReads } from '../../../_shared/services/leave-services';
import type { MyOverview } from '../../../_shared/types/leave-types';

const BUTTON = 'flex items-center justify-center font-wds-sans focus-visible:outline-none focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]';

function WaitingStrip({ waiting }: { waiting: NonNullable<MyOverview['waiting']> }) {
  const oldest = waiting.oldest;
  if (!oldest) return null;
  const many = waiting.count > 1;
  return (
    <Link href={myLeaveFollowHref(oldest.id)} className="block focus-visible:outline-none focus-visible:shadow-wds-ring" aria-label={`${many ? `${waiting.count} requests waiting` : '1 request waiting'}. Open the oldest.`}>
      <Callout tone="warning" size="sm" title={many ? `${waiting.count} requests waiting` : '1 request waiting'}>
        {`${oldest.typeLabel} · ${rangeShort(oldest.start, oldest.end)} · with ${waitingOn(oldest.decidingRole)}`}
      </Callout>
    </Link>
  );
}

/** The Leave home on a phone (spec Step 2): days left as the headline, the waiting strip, one card per type, Ask for leave and History. */
export function LeaveHome() {
  const name = useAuthStore((s) => s.user?.name ?? '');
  const online = useOnline();
  const overview = useRemote(() => leaveReads.overview(), 'overview');
  const data = overview.data;
  const headline = data?.headline ?? null;

  let body: React.ReactNode;
  if (overview.status === 'loading') body = <ListSkeleton rows={4} columns={['fill', 60]} label={LEAVE_LOADING} />;
  else if (!data) body = <ErrorBlock title={LEAVE_LOAD_FAILED.title} line={LEAVE_LOAD_FAILED.line} onRetry={overview.reload} />;
  else if (data.casual || !data.onPolicy) body = <EmptyState kind="nothingYet" title={data.message ?? 'Leave starts when your contract starts.'} />;
  else if (data.cards.length === 0) body = <EmptyState kind="nothingYet" title="No leave is set up for you yet. Ask HR." />;
  else {
    body = (
      <>
        {data.waiting ? <WaitingStrip waiting={data.waiting} /> : null}
        {data.cards.map((card) => (
          <LeaveCard key={card.typeCode} card={card} />
        ))}
        <LeaveLegend />
        <div className="flex gap-2.5">
          {online ? (
            <Link href={MY_LEAVE_REQUEST} className={`${BUTTON} h-[46px] flex-1 bg-wds-primary text-[15px] font-semibold leading-[18px] text-wds-primary-fg`}>
              Ask for leave
            </Link>
          ) : (
            <span aria-disabled className={`${BUTTON} h-[46px] flex-1 cursor-not-allowed bg-wds-primary text-[15px] font-semibold leading-[18px] text-wds-primary-fg opacity-60`}>
              Ask for leave
            </span>
          )}
          <Link href={MY_LEAVE_HISTORY} className={`${BUTTON} h-[46px] border border-wds-border-strong px-[22px] text-[15px] font-medium leading-[18px] text-wds-text-ink`}>
            History
          </Link>
        </div>
        {!online ? <p role="status" className="m-0 text-center font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{NO_CONNECTION}</p> : null}
      </>
    );
  }

  const year = data?.year ?? new Date().getFullYear();
  const figure = headline ? `${headline.left} ${headline.left === 1 ? 'day' : 'days'}` : undefined;
  return (
    <PhoneScreen
      screen="My leave"
      kicker="MY LEAVE"
      back="/app/workforce"
      figureSize="lg"
      figure={figure}
      title={figure ? undefined : 'My leave'}
      subtitle={figure ? `of annual leave left for ${year}${name ? ` · ${name}` : ''}` : undefined}
      desktopTitle="My leave"
    >
      {body}
    </PhoneScreen>
  );
}
