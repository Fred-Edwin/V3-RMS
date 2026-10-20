'use client';

import { PinActDialog } from '../_shared/components/pin-act-dialog';
import { kesLabel, monthName, people } from '../_shared/lib/format';
import { payrollWrites } from '../_shared/services/payroll-writes';
import type { MonthView } from '../_shared/types/month-types';

/**
 * HR publishes the payslips (spec S7). One act, one transaction on the server: nothing is half published. Staff are told the moment it
 * commits. The month is not locked by publishing; corrections stay open until the Accountant marks it paid.
 */
export function PublishDialog({ view, onClose, onDone, onStale }: { view: MonthView; onClose: () => void; onDone: (message: string) => void; onStale: () => void }) {
  const k = view.kpis;
  const name = monthName(view.monthKey);
  const approvedBy = view.stages.find((s) => s.key === 'APPROVED')?.who;
  return (
    <PinActDialog
      title={`Publish the ${name} payslips?`}
      description="Once published, staff can see their payslip. HR or the Accountant can still correct a payslip until the month is paid."
      rows={[
        { label: 'People to publish', value: String(k?.headcount ?? 0), mono: true },
        { label: 'Staff told', value: 'Push and Inbox' },
        { label: 'Staff see it under', value: 'My payslips' },
        { label: 'Net pay to staff', value: kesLabel(k?.net), mono: true },
        ...(approvedBy ? [{ label: 'Approved by', value: approvedBy.includes('(') ? approvedBy : `${approvedBy}, Accountant` }] : []),
        { label: 'After publishing', value: 'Open to correct until paid', tone: 'success' as const },
      ]}
      confirmLabel="Publish the payslips"
      busyLabel="Publishing…"
      note="Staff can see their own payslip straight away. Your name and the time are kept in the audit log."
      onClose={onClose}
      onStale={onStale}
      onAlready={(code) => {
        if (code !== 'ALREADY_PUBLISHED') return false;
        onDone(`${name} was published a moment ago.`);
        return true;
      }}
      onSign={async (pin, idempotencyKey) => {
        await payrollWrites.publish(view.monthKey, { pin, idempotencyKey, stateVersion: view.stateVersion });
        const n = k?.headcount ?? 0;
        onDone(`${name} payslips published. ${people(n)} ${n === 1 ? 'is' : 'are'} told.`);
      }}
    />
  );
}
