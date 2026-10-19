'use client';

import * as React from 'react';

import { Callout, ChoiceChips, DialogButton, EMPTY_REASON, KitDialog, ReasonChips, StatBoxes, isReasonComplete, reasonText, useAction, type ReasonValue } from '../../../_shared';
import { timesheetWrites } from '../../_shared/services/timesheet-services';
import { answeredCompare, requestedCompare } from '../../_shared/lib/request-compare';
import { hmWords, requestTitle, stampOf } from '../../_shared/lib/timesheet-words';
import type { InboxRequest } from '../../_shared/types/timesheet-types';
import { REQUEST_DECLINE_REASONS, approveNote, waitingWords } from '../lib/request-view';

const LABELS = Object.fromEntries(REQUEST_DECLINE_REASONS.map((r) => [r.key, r.label]));

/**
 * Answer one request: what the system recorded beside what the person says it should be, their line, and Approve or Decline. Declining
 * needs a reason. Approving a clock request makes the correction through the attendance fix door, so a closed month refuses it in words
 * (HR reopens first). A request that has gone to HR after three days is shown as such. Read-only for anyone who may not answer.
 */
export function RequestDialog({ request, canAct, onClose, onDone }: { request: InboxRequest; canAct: boolean; onClose: () => void; onDone: (message: string) => void }) {
  const [choice, setChoice] = React.useState<'APPROVE' | 'DECLINE'>('APPROVE');
  const [reason, setReason] = React.useState<ReasonValue>(EMPTY_REASON);
  const action = useAction((message) => onDone(message ?? 'Saved.'));
  const first = request.person.name.split(/\s+/)[0] ?? request.person.name;
  const waiting = request.state === 'WAITING';
  const compare = requestedCompare(request);
  const after = answeredCompare(request);
  const text = reasonText(reason, LABELS);
  const ready = choice === 'APPROVE' || isReasonComplete(reason);

  const save = (): void => {
    const body = choice === 'APPROVE' ? ({ outcome: 'APPROVE' } as const) : ({ outcome: 'DECLINE', reason: text ?? '' } as const);
    void action.run(() => timesheetWrites.decideRequest(request.id, body), choice === 'APPROVE' ? `Approved. ${first} is told.` : `Not approved. ${first} is told why.`);
  };

  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      busy={action.busy}
      width={620}
      title={`${request.person.name} · ${requestTitle(request.kind, request.requested, request.shiftDate)}`}
      description={`Sent ${stampOf(request.createdAt)} · ${waitingWords(request)}`}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" disabled={action.busy} onClick={onClose}>
            {waiting && canAct ? 'Cancel' : 'Close'}
          </DialogButton>
          {waiting && canAct ? (
            <DialogButton kind="primary" size="lg" disabled={!ready || action.busy} onClick={save}>
              {action.busy ? 'Saving…' : choice === 'APPROVE' ? 'Approve' : 'Decline'}
            </DialogButton>
          ) : null}
        </>
      }
    >
      {request.escalatedToHr && waiting ? (
        <Callout tone="warning" size="sm" title="This has gone to HR">
          Nobody answered in {request.waitingDays} days, so it is also with HR{request.waitingOnName ? ` (${request.waitingOnName})` : ''}.
        </Callout>
      ) : null}
      {compare ? (
        <StatBoxes variant="compare" cells={[{ label: 'RECORDED', value: compare.was, tone: 'error' }, { label: 'I SAY IT SHOULD BE', value: compare.want, tone: 'success' }]} />
      ) : null}
      {request.kind === 'OVERTIME_MISSING' && typeof request.requested.minutes === 'number' ? <p className="m-0 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">They say they worked {hmWords(request.requested.minutes)} extra.</p> : null}
      <p className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-ink">“{request.note}”</p>

      {!waiting ? (
        <Callout tone={request.state === 'APPROVED' ? 'success' : 'neutral'} size="sm" title={waitingWords(request)}>
          {request.decisionReason ? `Reason: ${request.decisionReason}` : null}
          {after ? ` The day went from ${after.was} to ${after.want}.` : null}
        </Callout>
      ) : null}

      {waiting && canAct ? (
        <>
          <ChoiceChips legend="Your answer" legendStyle="sentence" value={choice} onChange={(v) => setChoice(v as 'APPROVE' | 'DECLINE')} name="request-answer" options={[{ value: 'APPROVE', label: 'Approve' }, { value: 'DECLINE', label: 'Decline' }]} />
          {choice === 'APPROVE' ? (
            <Callout tone="neutral" bullet size="sm">
              {approveNote(request.kind)}
            </Callout>
          ) : (
            <ReasonChips legend="Say why" legendStyle="sentence" hint="required" options={REQUEST_DECLINE_REASONS} value={reason} onChange={setReason} name="request-decline" otherLabel="Other, with a note" />
          )}
        </>
      ) : null}
      {action.error ? (
        <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {action.error}
        </p>
      ) : null}
    </KitDialog>
  );
}
