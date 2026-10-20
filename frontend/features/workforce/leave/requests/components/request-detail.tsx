'use client';

import Link from 'next/link';
import * as React from 'react';

import { DialogButton, ErrorBlock, ListSkeleton, useRemote } from '../../../_shared';
import { useOnline } from '../../_shared/hooks/use-online';
import { declineSentence, whyNotText } from '../../_shared/lib/leave-copy';
import { momentLabel, nairobiToday, rangeLong } from '../../_shared/lib/leave-dates';
import { leaveToast } from '../../_shared/lib/leave-toast';
import { managerSlipHref } from '../../_shared/lib/leave-routes';
import { leaveReads } from '../../_shared/services/leave-services';
import type { ApplicationDetail } from '../../_shared/types/leave-types';
import { ApproveDialog } from './approve-dialog';
import { CancelApprovedDialog } from './cancel-approved-dialog';
import { DeclineDialog } from './decline-dialog';
import { RotaStrip } from './rota-strip';

function Outcome({ detail }: { detail: ApplicationDetail }) {
  const a = detail.application;
  const d = detail.decision;
  const who = d?.byRole ?? 'the decider';
  const text =
    a.status === 'APPROVED' ? `Approved by ${who}${d?.at ? `, ${momentLabel(d.at)}` : ''}${a.slipCode ? ` · ${a.slipCode}` : ''}`
    : a.status === 'DECLINED' ? `Declined by ${who}${d?.at ? `, ${momentLabel(d.at)}` : ''}`
    : `Cancelled${d?.at ? `, ${momentLabel(d.at)}` : ''}`;
  return (
    <div className="flex flex-col gap-2 border-t border-wds-border pt-4">
      <p className="m-0 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink" role="status">{text}</p>
      {a.status === 'DECLINED' ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{declineSentence(d?.reasonCode ?? null, d?.note ?? null, detail.person.department)}</p> : null}
    </div>
  );
}

/**
 * The right-hand panel of the Requests tab (spec Step 10): who asked, the team on those days, and Approve or Decline for the routed
 * decider. Other readers see the same, read-only, with the reason as text. The Approve and Decline buttons come from the server's `can`.
 */
export function RequestDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const online = useOnline();
  const remote = useRemote(() => leaveReads.detail(id), `request:${id}`);
  const rota = useRemote(() => leaveReads.rota(id), `rota:${id}`);
  const [dialog, setDialog] = React.useState<'approve' | 'decline' | 'cancel' | null>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => { if (remote.status === 'ready') heading.current?.focus({ preventScroll: true }); }, [id, remote.status]);

  const detail = remote.data;
  if (remote.status === 'loading') return <div className="p-6"><ListSkeleton rows={5} columns={['fill']} label="Loading the request" /></div>;
  if (!detail) return <div className="p-6"><ErrorBlock title="This request did not load" line={remote.error?.status === 404 ? 'It may have been removed.' : 'Nothing was changed. Check your connection and try again.'} onRetry={remote.reload} /></div>;

  const a = detail.application;
  const today = nairobiToday();
  const started = a.status === 'WAITING' && a.start < today;
  const reload = (): void => { remote.reload(); rota.reload(); onChanged(); };
  const rotaData = rota.data;
  const noConnection = !online ? 'No connection.' : null;

  return (
    <article aria-label="Request detail" className="flex flex-col gap-4 p-[22px]">
      <div className="flex flex-col gap-1">
        <h2 ref={heading} tabIndex={-1} className="m-0 font-wds-sans text-[20px] font-semibold leading-[26px] text-wds-text-ink focus-visible:outline-none">{`${detail.person.name}, ${detail.person.roleLabel} · ${a.typeLabel}`}</h2>
        <p className="m-0 font-wds-mono text-[13px] leading-4 text-wds-text-ink">{`${rangeLong(a.start, a.end)} · ${a.days} ${a.days === 1 ? 'day' : 'days'}${a.unpaidTailDays ? ` (${a.unpaidTailDays} unpaid)` : ''}`}</p>
        <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          {[`Asked ${momentLabel(a.askedAt)}`, rotaData && rotaData.balanceBefore !== null ? `balance ${rotaData.balanceBefore} days, ${rotaData.balanceAfter ?? '–'} after this` : null, detail.person.department ? `${detail.person.department}${detail.person.head ? `, head ${detail.person.head}` : ''}` : null, detail.person.site].filter(Boolean).join(' · ')}
        </p>
        {detail.note ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{`“${detail.note}”`}</p> : null}
      </div>

      {rota.status === 'loading' ? <ListSkeleton rows={3} columns={[90, 'fill']} label="Loading the team" /> : rotaData ? <RotaStrip rota={rotaData} personId={detail.person.id} /> : <ErrorBlock title="The team did not load" line="The decision does not depend on it. You can try again." onRetry={rota.reload} />}

      {started ? <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">These days have already started. Decline it or ask the person to send new dates.</p> : null}

      {a.status !== 'WAITING' ? <Outcome detail={detail} /> : null}
      <div className="flex flex-wrap items-center gap-2.5">
        {detail.can.approve ? <DialogButton kind="primary" size="lg" disabled={!online} onClick={() => setDialog('approve')}>Approve</DialogButton> : null}
        {detail.can.decline ? <DialogButton kind="cancel" size="lg" disabled={!online} onClick={() => setDialog('decline')}>Decline with a reason</DialogButton> : null}
        {detail.can.slip && a.slipCode ? <Link href={managerSlipHref(a.id)} className="inline-flex h-[38px] items-center border border-wds-border-strong px-5 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:shadow-wds-ring">Open leave slip</Link> : null}
        {detail.can.cancelApproved ? <DialogButton kind="cancel" size="lg" disabled={!online} onClick={() => setDialog('cancel')}>Cancel this leave</DialogButton> : null}
        {noConnection && (detail.can.approve || detail.can.decline) ? <span role="status" className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{noConnection}</span> : null}
        {detail.whyNot ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{whyNotText(detail.whyNot)}</span> : null}
      </div>
      {detail.can.approve || detail.can.decline ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{detail.person.head ? `${detail.person.head}, head of ${detail.person.department ?? 'the department'}, is told when you decide.` : 'The person is told when you decide.'}</p> : null}

      <ApproveDialog open={dialog === 'approve'} onOpenChange={(o) => setDialog(o ? 'approve' : null)} detail={detail} rota={rotaData} onChanged={() => { leaveToast('Someone answered this a moment ago.', 'info'); reload(); }} onApproved={(r) => { leaveToast(`Approved. Leave slip ${r.slipCode} issued.`); reload(); }} />
      <DeclineDialog open={dialog === 'decline'} onOpenChange={(o) => setDialog(o ? 'decline' : null)} detail={detail} onChanged={() => { leaveToast('Someone answered this a moment ago.', 'info'); reload(); }} onDeclined={() => { leaveToast(`Declined. ${detail.person.name}, ${detail.person.roleLabel}, is told.`); reload(); }} />
      <CancelApprovedDialog open={dialog === 'cancel'} onOpenChange={(o) => setDialog(o ? 'cancel' : null)} detail={detail} onChanged={reload} onCancelled={() => { leaveToast('Cancelled. The days are back in the balance.'); reload(); }} />
    </article>
  );
}
