'use client';

import { cn } from '@/lib/cn';

import { Callout, PhoneButton, StatBoxes } from '../../../_shared';
import { answeredCompare, dayNowMinutes, shortCompare } from '../../_shared/lib/request-compare';
import { REQUEST_STATE_WORDS, dayLong, hm, plainName, requestTitle, stampOf, weekdayOf } from '../../_shared/lib/timesheet-words';
import type { Request, RequestState } from '../../_shared/types/timesheet-types';

const EDGE: Record<RequestState, string> = { WAITING: 'border-l-wds-caramel-600', APPROVED: 'border-l-wds-success-fg', DECLINED: 'border-l-wds-error-fg', WITHDRAWN: 'border-l-wds-neutral-400' };
const WORD: Record<RequestState, string> = { WAITING: 'text-wds-warning-fg', APPROVED: 'text-wds-success-fg', DECLINED: 'text-wds-error-fg', WITHDRAWN: 'text-wds-text-secondary' };

/** The state in mono capitals, as Paper writes it: "WAITING 3 DAYS", "APPROVED", "NOT APPROVED". */
export function stateWords(request: Pick<Request, 'state' | 'waitingDays'>): string {
  if (request.state !== 'WAITING') return REQUEST_STATE_WORDS[request.state];
  return request.waitingDays > 0 ? `WAITING ${request.waitingDays} ${request.waitingDays === 1 ? 'DAY' : 'DAYS'}` : 'WAITING';
}

/**
 * One request of mine, which never disappears (Paper Chapter 9, step 3). Waiting shows what I sent and that it has not been answered; after
 * three days it says it has also gone to HR and that I need do nothing. Answered shows what the time was and what it is now, who answered
 * and, if it was refused, why. I can take a waiting request back.
 */
export function RequestCard({ request, busy, onWithdraw }: { request: Request; busy: boolean; onWithdraw: (id: string) => void }) {
  const after = answeredCompare(request);
  const now = dayNowMinutes(request);
  const answeredOn = request.decidedAt ? stampOf(request.decidedAt).split(',')[0] : '';
  const by = request.decidedByName ? plainName(request.decidedByName) : 'your manager';
  return (
    <li className={cn('flex flex-col gap-2.5 border border-l-[3px] border-wds-border bg-wds-surface px-4 py-3.5', EDGE[request.state])}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">{requestTitle(request.kind, request.requested, request.shiftDate)}</h3>
        <span className={cn('shrink-0 font-wds-mono text-[10px] leading-3 tracking-[0.06em]', WORD[request.state])}>{stateWords(request)}</span>
      </div>

      {request.state === 'WAITING' ? (
        <>
          <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{shortCompare(request)}</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 font-wds-sans text-[14px] leading-[18px]">
            <li className="flex items-center gap-2.5 text-wds-text-ink">
              <span aria-hidden className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-wds-success-fg text-[11px] leading-none text-white">✓</span>
              Sent {stampOf(request.createdAt)}
            </li>
            <li className="flex items-center gap-2.5 text-wds-warning-fg">
              <span aria-hidden className="size-[18px] shrink-0 rounded-full border-2 border-wds-caramel-600" />
              {request.escalatedToHr ? 'Not answered yet, and with HR too' : 'Not answered yet'}
            </li>
          </ul>
          {request.escalatedToHr ? (
            <Callout tone="warning" size="sm">
              Nobody has answered in {request.waitingDays} days, so this has also gone to HR{request.waitingOnName ? ` (${plainName(request.waitingOnName)})` : ''}. You do not need to do anything.
            </Callout>
          ) : null}
          <PhoneButton kind="outlined" size="sm" disabled={busy} onClick={() => onWithdraw(request.id)}>
            Take this request back
          </PhoneButton>
        </>
      ) : null}

      {request.state === 'APPROVED' ? (
        <>
          {after ? <StatBoxes variant="compare" row cells={[{ label: 'WAS', value: <s>{after.was}</s>, tone: 'error' }, { label: 'NOW', value: after.want, tone: 'success' }]} /> : null}
          <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
            Answered by {by}, {answeredOn}.{now !== null ? ` Your ${weekdayOf(request.shiftDate)} now shows ${hm(now)}.` : ''}
          </p>
        </>
      ) : null}

      {request.state === 'DECLINED' ? (
        <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
          Reason from {by}: {request.decisionReason ?? 'none given'}. Ask them if you disagree.
        </p>
      ) : null}

      {request.state === 'WITHDRAWN' ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">You took this back. Your time for {dayLong(request.shiftDate)} stayed as recorded.</p> : null}
    </li>
  );
}
