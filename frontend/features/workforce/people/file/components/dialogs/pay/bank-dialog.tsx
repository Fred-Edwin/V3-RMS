'use client';

import * as React from 'react';

import { Callout, ChoiceChips, DialogButton, KitDialog } from '../../../../../_shared';
import { peopleWrites } from '../../../../_shared/services/people-writes';
import type { PayProfileBody } from '../../../../_shared/types/people-requests';
import type { PayoutMethod } from '../../../../_shared/types/people-types';
import { useFileAction } from '../../../hooks/use-file-action';
import { firstName } from '../../../lib/file-model';
import { KENYAN_BANKS, OTHER_BANK, isListedBank } from '../../../../_shared/lib/kenyan-banks';
import { DialogError, DialogPicker, DialogText, FooterNote } from '../dialog-fields';
import type { FileDialogProps } from '../file-dialogs';

interface BankForm {
  method: PayoutMethod | null;
  bankName: string;
  accountName: string;
  accountNumber: string;
  mpesaPhone: string;
  reason: string;
}

export function bankBody(f: BankForm): PayProfileBody {
  if (f.method === 'BANK') return { payoutMethod: 'BANK', bankName: f.bankName.trim(), accountName: f.accountName.trim(), accountNumber: f.accountNumber.trim(), ...(f.reason.trim() ? { reason: f.reason.trim() } : {}) };
  if (f.method === 'MPESA') return { payoutMethod: 'MPESA', mpesaPhone: f.mpesaPhone.trim(), ...(f.reason.trim() ? { reason: f.reason.trim() } : {}) };
  return { payoutMethod: 'CASH' };
}

export function bankIncomplete(f: BankForm): string | null {
  if (f.method === null) return 'Choose how they are paid out.';
  if (f.method === 'BANK' && (f.bankName.trim() === '' || f.accountNumber.trim() === '')) return 'Enter the bank and the account number.';
  if (f.method === 'MPESA' && f.mpesaPhone.trim() === '') return 'Enter the M-Pesa number.';
  return null;
}

/** Pay-out details (W9): bank account, M-Pesa or cash. Changing an account that exists asks for a reason and tells the Accountant. */
export function BankDialog({ file, onClose, done }: FileDialogProps) {
  const [form, setForm] = React.useState<BankForm>({ method: null, bankName: '', accountName: file.name, accountNumber: '', mpesaPhone: '', reason: '' });
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Pay-out saved.'));
  const first = firstName(file.name);
  const set = (patch: Partial<BankForm>): void => setForm((f) => ({ ...f, ...patch }));
  const problem = bankIncomplete(form);
  const save = (): void => {
    setShown(true);
    if (problem) return;
    void action.run(() => peopleWrites.updatePayProfile(file.id, bankBody(form)), `${first}'s pay-out details are saved.`);
  };
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`How ${first} is paid`}
      description={file.employment === 'CASUAL' ? 'Bank account, M-Pesa or cash.' : 'Bank account or M-Pesa.'}
      busy={action.busy}
      footer={
        <>
          <FooterNote>Logged. The Accountant is told.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={save} disabled={action.busy}>{action.busy ? 'Saving…' : 'Save'}</DialogButton>
        </>
      }
    >
      <ChoiceChips legend="How are they paid out?" value={form.method} onChange={(v) => set({ method: v as PayoutMethod })} options={[{ value: 'BANK', label: 'Bank account' }, { value: 'MPESA', label: 'M-Pesa' }, ...(file.employment === 'CASUAL' ? [{ value: 'CASH', label: 'Cash' }] : [])]} />
      {form.method === 'BANK' ? (
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <DialogPicker
            label="Bank"
            value={form.bankName === '' ? '' : isListedBank(form.bankName) ? form.bankName : OTHER_BANK}
            placeholder="Choose the bank"
            options={[...KENYAN_BANKS, OTHER_BANK].map((b) => ({ value: b, label: b }))}
            onChange={(v) => set({ bankName: v === OTHER_BANK ? ' ' : v })}
          />
          {form.bankName !== '' && !isListedBank(form.bankName) ? (
            <DialogText label="Name of the bank" value={form.bankName.trim() === '' ? '' : form.bankName} onChange={(v) => set({ bankName: v === '' ? ' ' : v })} />
          ) : null}
          <DialogText label="Account number" mono value={form.accountNumber} onChange={(v) => set({ accountNumber: v })} />
          <DialogText label="Account name" value={form.accountName} onChange={(v) => set({ accountName: v })} className="col-span-2 max-sm:col-span-1" />
          <DialogText label="Reason" hint="optional" value={form.reason} onChange={(v) => set({ reason: v })} helper="Needed when you replace an account that is already on file." className="col-span-2 max-sm:col-span-1" />
        </div>
      ) : null}
      {form.method === 'MPESA' ? <DialogText label="M-Pesa number" type="tel" value={form.mpesaPhone} onChange={(v) => set({ mpesaPhone: v })} /> : null}
      {shown && problem ? <Callout tone="error" role="alert" size="sm">{problem}</Callout> : null}
      <DialogError message={action.error} />
    </KitDialog>
  );
}
