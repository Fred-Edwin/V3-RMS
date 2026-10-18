'use client';

import * as React from 'react';

import { Callout, ChoiceChips, DialogButton, EMPTY_REASON, KitDialog, ReasonChips, TimeField, reasonText, useAction, type ReasonValue } from '../../../_shared';
import { hmOf, longDayWords, minutesBetween } from '../../_shared/lib/nairobi-clock';
import { attendanceWrites } from '../../_shared/services/attendance-services';
import type { DayHistory } from '../../_shared/types/attendance-types';
import { bodyOf, changeProblem, countingEvents } from '../lib/fix-model';

const REASONS = [
  { key: 'busy', label: 'Busy, customers waiting' },
  { key: 'closing', label: 'Closing tasks' },
  { key: 'covering', label: 'Covering a colleague' },
] as const;
const LABELS = Object.fromEntries(REASONS.map((r) => [r.key, r.label]));

/**
 * A shift the phone closed (Paper Chapter 7 step 5): keep the closing time, or set the real finish. Either way the manager's answer
 * puts a correction on the clock-out, which is what takes the shift off the "needs a look" list. Time past the shift end goes to
 * overtime approval in slice 4; this only records when the person finished.
 */
export function ClosedShiftDialog({ history, entryId, onClose, onDone }: { history: DayHistory; entryId: string; onClose: () => void; onDone: (message: string) => void }) {
  const entry = history.entries.find((e) => e.entryId === entryId);
  const out = countingEvents(entry?.events ?? []).find((e) => e.type === 'OUT');
  const closedAt = out ? hmOf(out.countsAt ?? out.recordedAt) : (entry?.endTime ?? '');
  const first = history.name.split(/\s+/)[0] ?? history.name;
  const [choice, setChoice] = React.useState<'closed' | 'later'>('closed');
  const [hm, setHm] = React.useState('');
  const [reason, setReason] = React.useState<ReasonValue>(EMPTY_REASON);
  const action = useAction((m) => onDone(m ?? 'Saved.'));
  const text = reasonText(reason, LABELS);
  const chosenHm = choice === 'closed' ? closedAt : hm;
  const change = out ? ({ action: 'EDIT', eventId: out.id, hm: chosenHm } as const) : null;
  const problem = changeProblem(change, history.date, text, Date.now());
  const body = change && text ? bodyOf(change, history.employeeId, history.date, text, entryId) : null;
  const over = body && body.action === 'EDIT' && entry ? Math.max(0, minutesBetween(`${history.date}T${entry.endTime}:00+03:00`, body.at)) : 0;

  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      busy={action.busy}
      width={600}
      title={`${history.name}'s shift was closed by the phone`}
      description={`${longDayWords(history.date)} · ${entry?.templateName ?? ''} ${entry?.startTime ?? ''} to ${entry?.endTime ?? ''}`}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" disabled={action.busy} onClick={onClose}>
            Cancel
          </DialogButton>
          <DialogButton kind="primary" size="lg" disabled={action.busy || problem !== null} title={problem ?? undefined} onClick={() => body && void action.run(() => attendanceWrites.applyFix(body), `Saved. ${first} is told what you recorded.`)}>
            {action.busy ? 'Saving…' : choice === 'closed' ? `Keep ${closedAt}` : `Save ${hm || '--:--'}`}
          </DialogButton>
        </>
      }
    >
      <Callout tone="warning" size="sm">
        The phone asked {first} to finish or stay on and had no answer for the rule&apos;s wait, so the system closed the shift at {closedAt} and flagged it.
      </Callout>
      <ChoiceChips
        legend={`When did ${first} really finish?`}
        legendStyle="sentence"
        value={choice}
        onChange={(v) => setChoice(v === 'later' ? 'later' : 'closed')}
        options={[
          { value: 'closed', label: `At ${closedAt}, as closed` },
          { value: 'later', label: 'Later, at a time I set' },
        ]}
      />
      {choice === 'later' ? (
        <TimeField label="Real finish" value={hm} onChange={setHm} helper={over > 0 ? `${over} min after the shift end` : undefined} className="w-[160px]" />
      ) : null}
      <ReasonChips legend="Reason" legendStyle="sentence" hint="required" options={[...REASONS]} value={reason} onChange={setReason} disabled={action.busy} />
      <Callout size="sm" bullet>
        Time past the shift end goes to overtime for you to approve on the timesheet. {first} is told what you recorded. It is written to the audit log.
      </Callout>
      {action.error ? <Callout tone="error" role="alert" size="sm">{action.error}</Callout> : null}
    </KitDialog>
  );
}
