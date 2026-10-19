'use client';

import * as React from 'react';

import { ChangeDialog, EMPTY_REASON, ReasonChips, isReasonComplete, reasonText, useAction, type ReasonOption, type ReasonValue } from '../../../_shared';
import { timesheetWrites } from '../../_shared/services/timesheet-services';
import { dayLong } from '../../_shared/lib/timesheet-words';
import type { Day } from '../../_shared/types/timesheet-types';

const EXCUSE: ReasonOption[] = [
  { key: 'transport', label: 'Transport or road problem' },
  { key: 'unwell', label: 'Was unwell' },
  { key: 'agreed', label: 'Agreed with me beforehand' },
];
const HOLD: ReasonOption[] = [
  { key: 'explain', label: 'Waiting for their explanation' },
  { key: 'clock', label: 'The clock needs checking first' },
  { key: 'hr', label: 'Needs HR to look' },
];
const LABELS = Object.fromEntries([...EXCUSE, ...HOLD].map((o) => [o.key, o.label]));

/** "Excuse the lateness" or "Hold this day back": both change what payroll sees, so both ask for a reason (rule 06). */
export function DayDecisionDialog({ day, personName, kind, onClose, onDone }: { day: Day; personName: string; kind: 'EXCUSE' | 'HOLD'; onClose: () => void; onDone: (message: string) => void }) {
  const [reason, setReason] = React.useState<ReasonValue>(EMPTY_REASON);
  const action = useAction((message) => onDone(message ?? 'Saved.'));
  const first = personName.split(/\s+/)[0] ?? personName;
  const excuse = kind === 'EXCUSE';
  const text = reasonText(reason, LABELS);
  return (
    <ChangeDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={excuse ? `Excuse ${first}'s lateness` : `Hold ${first}'s ${dayLong(day.shiftDate)}`}
      description={dayLong(day.shiftDate)}
      summaryCaption="WHAT CHANGES"
      summaryLines={
        excuse
          ? [`The ${day.minutesLate} minutes late stay on record, marked excused, so payroll does not count them against ${first}.`, `No clock time changes. ${first} is told, and it is logged.`]
          : [`The day stays open and is not approved. It moves to HR if it is still open when the month closes.`, `${first} is told, and it is logged.`]
      }
      confirmLabel={excuse ? 'Excuse lateness' : 'Hold this day'}
      confirmDisabledReason={isReasonComplete(reason) ? undefined : 'Choose a reason first.'}
      busy={action.busy}
      onConfirm={() => text && void action.run(() => timesheetWrites.decideDay(day.id, excuse ? { outcome: 'EXCUSE', reason: text } : { outcome: 'HOLD', reason: text }), excuse ? 'Lateness excused.' : 'Day held back.')}
    >
      <ReasonChips legend="Why" legendStyle="sentence" hint="required" options={excuse ? EXCUSE : HOLD} value={reason} onChange={setReason} name="day-reason" otherLabel="Other, with a note" />
      {action.error ? (
        <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {action.error}
        </p>
      ) : null}
    </ChangeDialog>
  );
}
