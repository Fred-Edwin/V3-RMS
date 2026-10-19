'use client';

import * as React from 'react';

import { ChangeDialog, EMPTY_REASON, ReasonChips, isReasonComplete, reasonText, useAction, type ReasonOption, type ReasonValue } from '../../../_shared';
import { timesheetWrites } from '../../_shared/services/timesheet-services';
import { monthOf } from '../../_shared/lib/timesheet-words';
import type { Period } from '../../_shared/types/timesheet-types';

const REASONS: ReasonOption[] = [
  { key: 'clock', label: 'A clock time was missed' },
  { key: 'request', label: 'A request was answered late' },
  { key: 'decision', label: 'A decision needs changing' },
];
const LABELS = Object.fromEntries(REASONS.map((r) => [r.key, r.label]));

/** HR reopens a closed month, with a reason that is kept in the audit trail. It closes again by itself the next day at 18:00. */
export function ReopenDialog({ period, onClose, onDone }: { period: Period; onClose: () => void; onDone: (message: string) => void }) {
  const [reason, setReason] = React.useState<ReasonValue>(EMPTY_REASON);
  const action = useAction((message) => onDone(message ?? 'Reopened.'));
  const text = reasonText(reason, LABELS);
  return (
    <ChangeDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Reopen ${monthOf(period)}?`}
      description={`${period.label} · report TSH-${String(period.reportNumber).padStart(4, '0')}`}
      summaryCaption="WHAT CHANGES"
      summaryLines={[
        'Days and overtime can be decided again, and clock times fixed, until it closes again by itself at 18:00 tomorrow.',
        'The manager’s signature on the report is cleared and the report is signed again after it closes.',
        'Your reason is logged in the audit trail.',
      ]}
      confirmLabel="Reopen this month"
      confirmDisabledReason={isReasonComplete(reason) ? undefined : 'Choose a reason first.'}
      busy={action.busy}
      onConfirm={() => text && void action.run(() => timesheetWrites.reopen(period.id, text), 'Reopened. It closes again by itself tomorrow at 18:00.')}
    >
      <ReasonChips legend="Why are you reopening it" legendStyle="sentence" hint="required" options={REASONS} value={reason} onChange={setReason} name="reopen-reason" otherLabel="Other, with a note" />
      {action.error ? (
        <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {action.error}
        </p>
      ) : null}
    </ChangeDialog>
  );
}
