'use client';

import * as React from 'react';

import { Callout, DialogButton, EMPTY_REASON, FormField, KitDialog, ReasonChips, TimeField, reasonText, useAction, type ReasonValue } from '../../../_shared';
import { hmOf, minutesBetween } from '../../_shared/lib/nairobi-clock';
import { attendanceWrites } from '../../_shared/services/attendance-services';
import { CLOCK_FOR_REASONS, bodyOf, changeProblem } from '../lib/fix-model';

const LABELS = Object.fromEntries(CLOCK_FOR_REASONS.map((r) => [r.key, r.label]));

/**
 * "Clock in for someone" (Paper Chapter 7 step 3): the time they arrived and why they could not clock in, both required. Recorded as
 * entered by the manager, the person is told, it is written to the audit log. Today only; the server refuses a person outside the
 * caller's own people, and a manager's own time (nobody fixes their own).
 */
export function ClockForDialog({
  employeeId,
  name,
  department,
  shiftLine,
  startsAt,
  date,
  onClose,
  onDone,
}: {
  employeeId: string;
  name: string;
  department: string;
  /** "Morning 06:00 to 14:00". */
  shiftLine: string;
  /** The shift's start, an instant, to say how late the arrival makes them. */
  startsAt: string;
  date: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const first = name.split(/\s+/)[0] ?? name;
  const [hm, setHm] = React.useState(() => hmOf(Date.now()));
  const [reason, setReason] = React.useState<ReasonValue>(EMPTY_REASON);
  const action = useAction((m) => onDone(m ?? 'Saved.'));
  const text = reasonText(reason, LABELS);
  const change = { action: 'ADD', type: 'IN', hm } as const;
  const problem = changeProblem(change, date, text, Date.now());
  const body = bodyOf(change, employeeId, date, text ?? '');
  const late = body && body.action === 'ADD' ? Math.max(0, minutesBetween(startsAt, body.at)) : 0;

  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      busy={action.busy}
      width={560}
      title={`Clock in for ${name}`}
      description={`${shiftLine} · ${department}`}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>
            Cancel
          </DialogButton>
          <DialogButton
            kind="primary"
            size="lg"
            disabled={action.busy || problem !== null}
            title={problem ?? undefined}
            onClick={() => body && text && void action.run(() => attendanceWrites.clockFor({ employeeId, type: 'IN', at: body.action === 'ADD' ? body.at : '', reason: text }), `Clocked in for ${name}. ${first} is told.`)}
          >
            {action.busy ? 'Saving…' : `Clock in at ${hm || '--:--'}`}
          </DialogButton>
        </>
      }
    >
      <FormField label={`What time did ${first} arrive?`} helper={late > 0 ? `Today. ${late} min after the shift started, so ${first} is recorded as ${late} min late.` : 'Today. Before the shift started, so on time.'}>
        {() => <TimeField label="Arrival time" value={hm} onChange={setHm} className="w-[140px]" />}
      </FormField>
      <ReasonChips legend={`Why could ${first} not clock in?`} legendStyle="sentence" hint="required" options={[...CLOCK_FOR_REASONS]} value={reason} onChange={setReason} disabled={action.busy} />
      <Callout size="sm" bullet>
        Recorded as entered by you, with the reason. {first} is told and can ask for it to be put right. It is written to the audit log.
      </Callout>
      {action.error ? <Callout tone="error" role="alert" size="sm">{action.error}</Callout> : null}
    </KitDialog>
  );
}
