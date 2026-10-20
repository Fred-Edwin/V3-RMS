'use client';

import * as React from 'react';

import { ApiError } from '@/types/api';

import { ChoiceChips, DialogButton, FIELD_CLASS, FormField, KitDialog } from '../../_shared';
import { PadNumberInput } from '@/components/ui2/quantity-field';

import { PinActDialog } from '../_shared/components/pin-act-dialog';
import { newKey } from '../_shared/lib/format';
import { STALE_CODES, refusalWords } from '../_shared/lib/month-view';
import { payrollWrites } from '../_shared/services/payroll-writes';
import { ADJUSTMENT_TYPES, type AdjustmentType, type ReviewLine } from '../_shared/types/action-types';
import type { MonthView } from '../_shared/types/month-types';

const TYPE_WORDS: Record<AdjustmentType, string> = {
  ALLOWANCE: 'Allowance',
  INCENTIVE: 'Incentive',
  ARREARS: 'Arrears',
  OTHER_EARNING: 'Other earning',
  ADVANCE_REPAID: 'Advance repaid',
  HELB: 'HELB',
  OTHER_DEDUCTION: 'Other deduction',
};
const EARNINGS: readonly AdjustmentType[] = ['ALLOWANCE', 'INCENTIVE', 'ARREARS', 'OTHER_EARNING'];

/** A short written reason and nothing else, for acts that need no PIN (leave out, Calculate again confirm). */
function useQuickAct(onStale: () => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const key = React.useRef(newKey());
  const run = async (write: (idempotencyKey: string) => Promise<unknown>, done: () => void): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await write(key.current);
      done();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      setError(err instanceof ApiError ? refusalWords(code, err.message) : 'The connection dropped. Nothing was changed. Try again.');
      if (STALE_CODES.includes(code)) {
        key.current = newKey();
        onStale();
      }
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** Leave a person out of this run (spec S5): paid in the next run once the problem is fixed. A reason is kept in the audit log. */
export function LeaveOutDialog({ view, line, onClose, onDone, onStale }: { view: MonthView; line: ReviewLine; onClose: () => void; onDone: (message: string) => void; onStale: () => void }) {
  const [reason, setReason] = React.useState('');
  const act = useQuickAct(onStale);
  const trimmed = reason.trim();
  return (
    <KitDialog
      open
      plain
      busy={act.busy}
      width={540}
      onOpenChange={(o) => !o && onClose()}
      title="Leave this person out of this run?"
      description={`${line.name}, ${line.siteName}. They have no payslip this month and are paid in the next run once the problem is fixed.`}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={act.busy}>
            Cancel
          </DialogButton>
          <DialogButton
            kind="primary"
            size="lg"
            disabled={act.busy || trimmed.length < 5}
            onClick={() => void act.run((idempotencyKey) => payrollWrites.leaveOut(view.monthKey, line.id, { reason: trimmed, stateVersion: view.stateVersion, idempotencyKey }), () => onDone('Left out of this run. The month is worked out again.'))}
          >
            {act.busy ? 'Leaving out…' : 'Leave out of this run'}
          </DialogButton>
        </>
      }
    >
      <FormField label="Why?" hint="required" helper={trimmed.length < 5 ? 'Add your reason (at least 5 characters). Leave amounts out.' : undefined} error={act.error ?? undefined}>
        {({ id, describedBy, invalid }) => <textarea id={id} autoComplete="off" aria-describedby={describedBy} aria-invalid={invalid} rows={3} maxLength={280} value={reason} onChange={(e) => setReason(e.target.value)} className={`${FIELD_CLASS} h-auto py-2`} />}
      </FormField>
    </KitDialog>
  );
}

/** Calculate again (spec S5): every figure is worked out again from the same approved timesheets; ticks are cleared; adjustments are kept. */
export function RecalculateDialog({ view, onClose, onDone, onStale }: { view: MonthView; onClose: () => void; onDone: (message: string) => void; onStale: () => void }) {
  const act = useQuickAct(onStale);
  return (
    <KitDialog
      open
      plain
      busy={act.busy}
      width={500}
      onOpenChange={(o) => !o && onClose()}
      title="Calculate again?"
      description="Your ticks are cleared, and every figure is worked out again from the same approved timesheets and rules. Added lines and people left out are kept."
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={act.busy}>
            Cancel
          </DialogButton>
          <DialogButton kind="primary" size="lg" disabled={act.busy} onClick={() => void act.run((idempotencyKey) => payrollWrites.recalculate(view.monthKey, { idempotencyKey, stateVersion: view.stateVersion }), () => onDone('The month is calculated again. Check the lines.'))}>
            {act.busy ? 'Calculating…' : 'Calculate again'}
          </DialogButton>
        </>
      }
    >
      {act.error ? (
        <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {act.error}
        </p>
      ) : null}
    </KitDialog>
  );
}

/** Add a line to a person's payslip (spec S5, beyond Paper): a type, a name, an amount, taxable or not, why, and HR's PIN. */
export function AdjustmentDialog({ view, line, onClose, onDone, onStale }: { view: MonthView; line: ReviewLine; onClose: () => void; onDone: (message: string) => void; onStale: () => void }) {
  const [type, setType] = React.useState<AdjustmentType>('ALLOWANCE');
  const [label, setLabel] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [taxable, setTaxable] = React.useState(true);
  const [reason, setReason] = React.useState('');
  const earning = EARNINGS.includes(type);
  const amountOk = /^\d{1,8}(\.\d{1,2})?$/.test(amount) && Number(amount) >= 1 && Number(amount) <= 10_000_000;
  const problem = label.trim() === '' ? 'Give the line a name.' : !amountOk ? 'Use an amount from 1 to 10,000,000, with up to 2 decimals.' : reason.trim().length < 5 ? 'Add your reason (at least 5 characters).' : null;
  return (
    <PinActDialog
      title={`Add a line to ${line.name}'s payslip`}
      description={`${line.siteName}. The month is worked out again, and the new line comes back to you to tick.`}
      confirmLabel="Add the line"
      busyLabel="Adding…"
      blockedReason={problem}
      width={600}
      note="Recorded in the audit log with your name, the reason and the amount."
      onClose={onClose}
      onStale={onStale}
      onSign={async (pin, idempotencyKey) => {
        await payrollWrites.addAdjustment(view.monthKey, { employeeId: line.employeeId, type, label: label.trim(), amount, taxable: earning ? taxable : false, reason: reason.trim(), pin, idempotencyKey, stateVersion: view.stateVersion });
        onDone('Line added. The month is worked out again.');
      }}
    >
      <ChoiceChips legend="Type" legendStyle="caps" size="sm" value={type} onChange={(v) => setType(v as AdjustmentType)} options={ADJUSTMENT_TYPES.map((t) => ({ value: t, label: TYPE_WORDS[t] }))} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Label">{({ id }) => <input id={id} autoComplete="off" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} className={FIELD_CLASS} />}</FormField>
        <FormField label="Amount (KES)">{({ id }) => <PadNumberInput id={id} label="Amount in shillings" maxLength={11} value={amount} onChange={setAmount} className={`${FIELD_CLASS} font-wds-mono`} />}</FormField>
      </div>
      {earning ? (
        <ChoiceChips legend="Taxable" legendStyle="caps" size="sm" value={taxable ? 'yes' : 'no'} onChange={(v) => setTaxable(v === 'yes')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
      ) : null}
      <FormField label="Why?" hint="required">
        {({ id }) => <textarea id={id} autoComplete="off" rows={2} maxLength={280} value={reason} onChange={(e) => setReason(e.target.value)} className={`${FIELD_CLASS} h-auto py-2`} />}
      </FormField>
    </PinActDialog>
  );
}
