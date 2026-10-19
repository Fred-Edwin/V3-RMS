'use client';

import { WorkforcePinDialog, useAction } from '../../../_shared';
import { timesheetWrites } from '../../_shared/services/timesheet-services';
import { monthOf } from '../../_shared/lib/timesheet-words';
import type { Report } from '../../_shared/types/timesheet-types';

/**
 * The manager signs the closed report with their own PIN (the automatic close cannot ask for one, so the signature is its own step).
 * The PIN is never stored or logged; the audit entry records that it was a PIN and when. A wrong PIN is refused in words and the field clears.
 */
export function SignDialog({ report, onClose, onDone }: { report: Report; onClose: () => void; onDone: (message: string) => void }) {
  const action = useAction((message) => onDone(message ?? 'Signed.'));
  return (
    <WorkforcePinDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Sign ${report.number}`}
      description={`${report.organization} · ${monthOf(report.period)}`}
      summaryRows={[
        { label: 'Report', value: report.number },
        { label: 'Month', value: monthOf(report.period) },
        { label: 'People', value: String(report.summary.people) },
      ]}
      caption="Your signature goes on the report with the time, and it is logged."
      submitting={action.busy}
      error={action.error ?? undefined}
      confirmLabel="Sign the report"
      onSubmit={(pin) => void action.run(() => timesheetWrites.sign(report.period.id, pin), 'Signed.')}
    />
  );
}
