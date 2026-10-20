'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Callout, CircleStepper, ErrorBlock, ListSkeleton, PhoneButton, PhoneScreen, StatBoxes, useRemote } from '../../../../_shared';
import { DownloadSlipButton } from '../../../_shared/components/slip-buttons';
import { useOnline } from '../../../_shared/hooks/use-online';
import { declineSentence, titleLine } from '../../../_shared/lib/leave-copy';
import { rangeLong } from '../../../_shared/lib/leave-dates';
import { LEAVE_LOADING, NO_CONNECTION } from '../../../_shared/lib/leave-ui';
import { MY_LEAVE_HISTORY, myLeaveRequestHref, slipHref } from '../../../_shared/lib/leave-routes';
import { leaveReads } from '../../../_shared/services/leave-services';
import type { ApplicationDetail } from '../../../_shared/types/leave-types';
import { circleStepsOf } from '../lib/follow-steps';
import { CancelOwnDialog } from './cancel-own-dialog';

function Figures({ detail }: { detail: ApplicationDetail }) {
  const f = detail.figures;
  const a = detail.application;
  if ('before' in f) {
    return <StatBoxes variant="compare" row cells={[{ label: 'BEFORE', value: f.before === null ? '–' : String(f.before) }, { label: 'TAKEN', value: String(f.taken) }, { label: 'AFTER', value: f.after === null ? '–' : String(f.after), tone: 'success' }]} />;
  }
  if (a.status === 'DECLINED') {
    return <StatBoxes variant="compare" row cells={[{ label: 'ASKED', value: String(f.asked) }, { label: 'TAKEN OFF', value: '0' }, { label: 'STILL LEFT', value: f.leftNow === null ? '–' : String(f.leftNow) }]} />;
  }
  return <StatBoxes variant="compare" row cells={[{ label: 'ASKED', value: String(f.asked) }, { label: 'LEFT NOW', value: f.leftNow === null ? '–' : String(f.leftNow) }, { label: 'IF APPROVED', value: f.ifApproved === null ? '–' : String(f.ifApproved), tone: 'success' }]} />;
}

/** One request followed (spec Steps 3, 4 and 5): the stepper in the person's words, the figures, and what they may do next. */
export function FollowScreen({ id }: { id: string }) {
  const router = useRouter();
  const online = useOnline();
  const remote = useRemote(() => leaveReads.detail(id), `follow:${id}`);
  const [cancelling, setCancelling] = React.useState(false);
  const detail = remote.data;

  let body: React.ReactNode;
  if (remote.status === 'loading') body = <ListSkeleton rows={4} columns={[24, 'fill']} label={LEAVE_LOADING} />;
  else if (!detail) {
    body = remote.error?.status === 404
      ? <ErrorBlock title="We could not find that request" line="It may have been removed. Go back to your history." />
      : <ErrorBlock title="This request did not load" line="Nothing was changed. Check your connection and try again." onRetry={remote.reload} />;
  } else {
    const app = detail.application;
    const approvedLive = app.status === 'APPROVED';
    body = (
      <>
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 font-wds-sans text-[18px] font-semibold leading-6 text-wds-text-ink">{titleLine(app)}</h2>
          <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{`${rangeLong(app.start, app.end)}${app.slipCode ? ` · ${app.slipCode}` : ''}`}</p>
        </div>
        <CircleStepper label="Progress of this request" steps={circleStepsOf(detail)} />
        {app.status === 'DECLINED' ? (
          <Callout tone="error" size="sm">{`${declineSentence(detail.decision?.reasonCode ?? null, detail.decision?.note ?? null, detail.person.department)} Nothing was taken off your ${app.typeLabel.toLowerCase()}.`.trim()}</Callout>
        ) : null}
        <Figures detail={detail} />
        {detail.can.slip && app.slipCode ? (
          <div className="flex flex-col gap-2">
            <PhoneButton size="sm" onClick={() => router.push(slipHref(app.id))}>{app.status === 'CANCELLED' ? 'Open leave slip (cancelled)' : 'Open leave slip'}</PhoneButton>
            <DownloadSlipButton id={app.id} code={app.slipCode} label={app.status === 'CANCELLED' ? 'Download leave slip (cancelled)' : 'Download leave slip'} disabled={!online} />
          </div>
        ) : null}
        {detail.can.askAgain && app.status === 'DECLINED' ? (
          <Link href={myLeaveRequestHref(app.typeCode)} className="flex h-[46px] items-center justify-center bg-wds-primary font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-primary-fg focus-visible:outline-none focus-visible:shadow-wds-ring">Ask for other dates</Link>
        ) : null}
        {detail.can.cancel ? (
          <PhoneButton kind="outlined" size="sm" disabled={!online} onClick={() => setCancelling(true)}>
            {approvedLive ? 'Cancel this leave' : 'Cancel this request'}
          </PhoneButton>
        ) : null}
        {!detail.can.cancel && app.phase === 'ON_LEAVE' ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">This leave has started, so it cannot be cancelled. Ask HR.</p> : null}
        {!online ? <p role="status" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{NO_CONNECTION}</p> : null}
        <CancelOwnDialog open={cancelling} onOpenChange={setCancelling} id={app.id} decider={app.decidingRole} approved={approvedLive} onDone={remote.reload} />
      </>
    );
  }

  return (
    <PhoneScreen screen="My leave" kicker="HISTORY · YOUR REQUEST" back={MY_LEAVE_HISTORY} desktopTitle="Your request">
      {body}
    </PhoneScreen>
  );
}
