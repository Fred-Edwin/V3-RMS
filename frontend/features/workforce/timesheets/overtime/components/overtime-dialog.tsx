'use client';

import * as React from 'react';

import { Callout, ChoiceChips, DialogButton, EMPTY_REASON, KitDialog, ReasonChips, StatBoxes, isReasonComplete, reasonText, useAction, type ReasonValue } from '../../../_shared';
import { timesheetWrites } from '../../_shared/services/timesheet-services';
import { dayLong, hm, hmWords } from '../../_shared/lib/timesheet-words';
import type { Day, Overtime } from '../../_shared/types/timesheet-types';
import { DECLINE_REASONS, OVER_LIMIT_REASONS, evidenceLines, limitLines, partMinutes, reasonLabels, reasonNeeded, type OvertimeChoice } from '../lib/overtime-view';

const LABELS = reasonLabels([...DECLINE_REASONS, ...OVER_LIMIT_REASONS]);

function Lines({ caption, lines }: { caption: string; lines: string[] }) {
  return (
    <section aria-label={caption} className="flex min-w-0 flex-col gap-2">
      <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">{caption}</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {lines.map((line) => (
          <li key={line} className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Decide on overtime with the evidence beside it (Paper Chapter 8, step 3). You are only saying whether the extra time was authorised;
 * payroll decides pay from the Rules, so no money appears here. Declining needs a reason; so does authorising above the weekly or branch
 * limit. A department head over the limit is refused by the server in words (the dialog shows them).
 */
export function OvertimeDialog({ item, personName, day, onClose, onDone }: { item: Overtime; personName: string; day: Day | null; onClose: () => void; onDone: (message: string) => void }) {
  const part = partMinutes(item.needsMinutes);
  const [choice, setChoice] = React.useState<OvertimeChoice>('ALL');
  const [reason, setReason] = React.useState<ReasonValue>(EMPTY_REASON);
  const action = useAction((message) => onDone(message ?? 'Saved.'));
  const first = personName.split(/\s+/)[0] ?? personName;
  const needed = reasonNeeded(choice, item.limits.insideAllowance);
  const complete = needed === null || isReasonComplete(reason);
  React.useEffect(() => setReason(EMPTY_REASON), [needed]);
  const granted = choice === 'PART' && part !== null ? part : item.needsMinutes;

  const save = (): void => {
    const text = reasonText(reason, LABELS);
    const body = choice === 'DECLINE' ? ({ outcome: 'DECLINE', reason: text ?? '' } as const) : ({ outcome: 'APPROVE', minutes: granted, ...(text ? { reason: text } : {}) } as const);
    void action.run(() => timesheetWrites.decideOvertime(item.id, body), choice === 'DECLINE' ? `Declined. ${first} is told why.` : `Authorised ${hmWords(granted)}. ${first} is told.`);
  };

  const options = [
    { value: 'ALL', label: `Approve all ${hmWords(item.needsMinutes)}` },
    ...(part !== null ? [{ value: 'PART', label: `Approve part: ${hmWords(part)}` }] : []),
    { value: 'DECLINE', label: 'Decline' },
  ];

  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      busy={action.busy}
      width={720}
      title={`Overtime · ${personName} · ${hmWords(item.needsMinutes)}`}
      description={dayLong(item.shiftDate)}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>
            Cancel
          </DialogButton>
          <DialogButton kind="primary" size="lg" onClick={save} disabled={!complete || action.busy}>
            {action.busy ? 'Saving…' : 'Save my answer'}
          </DialogButton>
        </>
      }
    >
      <StatBoxes
        variant="times"
        cells={[
          { label: 'PLANNED', value: day ? hm(day.scheduledMinutes) : '—' },
          { label: 'WORKED', value: day ? hm(day.workedMinutes) : '—' },
          { label: 'EXTRA', value: `${hmWords(item.rawMinutes)} after shift end`, tone: 'warning' },
        ]}
      />
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <Lines caption="WHY, FROM THE RECORD" lines={evidenceLines(item)} />
        <Lines caption="THE LIMITS" lines={limitLines(item)} />
      </div>
      <ChoiceChips legend="Your decision" legendStyle="sentence" options={options} value={choice} onChange={(v) => setChoice(v as OvertimeChoice)} name="overtime-decision" />
      {needed ? (
        <ReasonChips
          legend={needed === 'decline' ? 'If you decline, say why' : 'This is above the limit. Say why you are authorising it'}
          legendStyle="sentence"
          hint="required"
          options={needed === 'decline' ? DECLINE_REASONS : OVER_LIMIT_REASONS}
          value={reason}
          onChange={setReason}
          otherLabel="Other, with a note"
          name="overtime-reason"
        />
      ) : null}
      <Callout tone="neutral" bullet size="sm">
        You are only saying whether this extra time was authorised. Whether it is paid at an overtime rate, or counted another way, is decided by payroll from the Rules. {first} is told your answer.
      </Callout>
      {action.error ? (
        <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {action.error}
        </p>
      ) : null}
    </KitDialog>
  );
}
