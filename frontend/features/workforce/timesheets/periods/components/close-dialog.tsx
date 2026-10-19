'use client';

import { Callout, ChangeSummary, DialogButton, KitDialog, StatBoxes, useAction } from '../../../_shared';
import { timesheetWrites } from '../../_shared/services/timesheet-services';
import { cutoffWords, hm, monthOf, wholeHours } from '../../_shared/lib/timesheet-words';
import type { PeriodView } from '../../_shared/types/timesheet-types';

/**
 * Close this month now (Paper Chapter 8, step 4). Closing only brings the cut-off forward: it fixes each person's hours against the
 * plan and hands them to payroll, which applies the Rules. Anything still open is left out and moves to HR in the next month; the
 * server needs `confirmCarry` for that, so the dialog says it in words first.
 */
export function CloseDialog({ view, branch, onClose, onDone }: { view: PeriodView; branch: string; onClose: () => void; onDone: (message: string) => void }) {
  const { period, summary } = view;
  const open = summary.needsLookDays + summary.pendingOvertimeItems;
  const action = useAction((message) => onDone(message ?? 'Closed.'));
  const things: string[] = [];
  if (summary.needsLookDays > 0) things.push(`${summary.needsLookDays} ${summary.needsLookDays === 1 ? 'day' : 'days'} to look at`);
  if (summary.pendingOvertimeItems > 0) things.push(`${summary.pendingOvertimeItems} overtime ${summary.pendingOvertimeItems === 1 ? 'answer' : 'answers'}`);
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      busy={action.busy}
      width={620}
      title="Close this month early?"
      description={`${branch} · ${monthOf(period)} · it would close by itself on ${cutoffWords(period)}`}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" disabled={action.busy} onClick={onClose}>
            Keep it open
          </DialogButton>
          <DialogButton kind="primary" size="lg" disabled={action.busy} onClick={() => void action.run(() => timesheetWrites.close(period.id, true), 'Closed. The report is ready to sign.')}>
            {action.busy ? 'Closing…' : 'Close now'}
          </DialogButton>
        </>
      }
    >
      <ChangeSummary
        caption="WHAT CLOSING DOES"
        lines={['It fixes each person’s hours worked against hours planned. Payroll then applies the Rules to those hours: overtime rates, lateness, unpaid absence. You do not decide any pay here.']}
      />
      <StatBoxes
        variant="figures"
        cells={[
          { label: 'HOURS', value: wholeHours(summary.workedMinutes) },
          { label: 'OVERTIME AUTHORISED', value: hm(summary.overtimeAuthorisedMinutes) },
          { label: 'LATE, RECORDED', value: String(summary.lateDays) },
        ]}
      />
      {open > 0 ? (
        <Callout tone="warning" title={`${open} ${open === 1 ? 'thing still needs' : 'things still need'} you`} size="sm">
          {things.join(' and ')}. If you close now they are left out of this run and move to next month, where HR sees them first.
        </Callout>
      ) : null}
      <Callout tone="neutral" size="sm">
        If you do nothing, the month closes by itself at the cut-off. Anything still open then is sent to HR so it is never lost. After closing, only HR can change a day, with a reason.
      </Callout>
      {action.error ? (
        <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {action.error}
        </p>
      ) : null}
    </KitDialog>
  );
}
