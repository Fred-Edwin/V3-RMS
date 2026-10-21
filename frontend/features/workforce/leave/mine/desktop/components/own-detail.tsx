'use client';

import Link from 'next/link';
import * as React from 'react';

import { CircleStepper, DialogButton, ErrorBlock, KeyValueRows, ListSkeleton, useRemote } from '../../../../_shared';
import { CancelOwnDialog } from '../../follow/components/cancel-own-dialog';
import { circleStepsOf } from '../../follow/lib/follow-steps';
import { useOnline } from '../../../_shared/hooks/use-online';
import { declineSentence } from '../../../_shared/lib/leave-copy';
import { momentLabel, rangeLong } from '../../../_shared/lib/leave-dates';
import { slipHref } from '../../../_shared/lib/leave-routes';
import { leaveReads } from '../../../_shared/services/leave-services';
import type { ApplicationDetail } from '../../../_shared/types/leave-types';

const PHASE_WORD: Record<string, string> = { WAITING: 'WAITING', BOOKED: 'APPROVED · BOOKED', ON_LEAVE: 'APPROVED · ON LEAVE', TAKEN: 'APPROVED · TAKEN', DECLINED: 'DECLINED', CANCELLED: 'CANCELLED' };

function rowsOf(detail: ApplicationDetail) {
  const a = detail.application;
  const f = detail.figures;
  const rows = [
    { label: 'Days counted', value: `${a.days}, every calendar day`, mono: false },
    { label: 'Asked', value: momentLabel(a.askedAt), mono: false },
  ];
  if (detail.decision?.at) {
    const who = `${detail.decision.byRole ?? ''}`.trim();
    rows.push({ label: a.status === 'DECLINED' ? 'Declined by' : a.status === 'CANCELLED' ? 'Cancelled' : 'Approved by', value: `${who ? `${who}, ` : ''}${momentLabel(detail.decision.at)}`, mono: false });
  }
  if ('before' in f && f.before !== null) rows.push({ label: 'Balance', value: `${f.before} d before, ${f.after ?? '–'} d after`, mono: true });
  return rows;
}

/** The request in full beside the list (spec Step 13): a waiting one has the stepper and Cancel; a finished one is kept as it was. */
export function OwnDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const online = useOnline();
  const remote = useRemote(() => leaveReads.detail(id), `own-detail:${id}`);
  const [cancelling, setCancelling] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const detail = remote.data;
  if (remote.status === 'loading') return <div className="p-6"><ListSkeleton rows={4} columns={['fill']} label="Loading the request" /></div>;
  if (!detail) return <div className="p-6"><ErrorBlock title="This request did not load" line="Nothing was changed. Try again." onRetry={remote.reload} /></div>;
  const a = detail.application;
  const reload = (): void => { remote.reload(); onChanged(); };
  return (
    <article aria-label="Request detail" className="flex flex-col gap-4 p-[22px]">
      <p className="m-0 font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-text-secondary">{`${PHASE_WORD[a.phase] ?? a.phase}${a.slipCode ? ` · ${a.slipCode}` : ''}`}</p>
      <h2 ref={headingRef} tabIndex={-1} className="m-0 font-wds-sans text-[20px] font-semibold leading-[26px] text-wds-text-ink focus-visible:outline-none">{`${a.typeLabel} · ${rangeLong(a.start, a.end)}`}</h2>
      {a.status === 'WAITING' ? <CircleStepper label="Progress of this request" steps={circleStepsOf(detail)} /> : <KeyValueRows aria-label="Request facts" rows={rowsOf(detail)} />}
      {a.status === 'DECLINED' ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">{declineSentence(detail.decision?.reasonCode ?? null, detail.decision?.note ?? null, detail.person.department)}</p> : null}
      <div className="flex flex-wrap items-center gap-2.5">
        {detail.can.slip && a.slipCode ? <Link href={slipHref(a.id)} className="inline-flex h-[38px] items-center bg-wds-primary px-[22px] font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-primary-fg focus-visible:outline-none focus-visible:shadow-wds-ring">Open leave slip</Link> : null}
        {detail.can.cancel ? <DialogButton kind="cancel" size="lg" disabled={!online} onClick={() => setCancelling(true)}>{a.status === 'APPROVED' ? 'Cancel this leave' : 'Cancel this request'}</DialogButton> : null}
      </div>
      {!detail.can.cancel ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">A request can be cancelled only while it is waiting or has not started.{a.phase === 'TAKEN' || a.phase === 'ON_LEAVE' ? ' This one is finished or under way, so it is kept as it was.' : ''}</p> : null}
      <CancelOwnDialog open={cancelling} onOpenChange={setCancelling} id={a.id} decider={a.decidingRole} approved={a.status === 'APPROVED'} onDone={reload} />
    </article>
  );
}
