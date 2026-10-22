'use client';

import * as React from 'react';

import { DialogButton, KitDialog } from '../../../_shared';
import { KENYAN_BANKS, OTHER_BANK } from '../../_shared/lib/kenyan-banks';
import type { EmployeeFile } from '../../_shared/types/people-types';
import { DialogDigits, DialogError, DialogPicker, DialogText, FooterNote } from '../../file/components/dialogs/dialog-fields';
import { useOwnNumbers } from '../hooks/use-own-numbers';

/**
 * Edit my IDs and bank on a desktop (the phone has its own page, frame 8.3). The person changes their own National ID, KRA PIN, NSSF,
 * SHA, HELB, bank and account at any time. It saves at once; HR does not re-check.
 */
export function OwnNumbersDialog({ file, onClose, done }: { file: Pick<EmployeeFile, 'sensitive'>; onClose: () => void; done: (message: string) => void }) {
  const n = useOwnNumbers(file, done);
  const { form, set, errors, shown } = n;
  const bankValue = n.otherBank ? OTHER_BANK : form.bankName;
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Edit my IDs and bank"
      description="Only you and HR see these. Changes save at once."
      width={440}
      busy={n.busy}
      footer={
        <>
          {n.bankChanging ? <FooterNote>The Accountant is told that your bank changed.</FooterNote> : null}
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={n.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={n.save} disabled={n.busy || !n.changed}>{n.busy ? 'Saving…' : 'Save'}</DialogButton>
        </>
      }
    >
      <DialogDigits label="National ID" maxLength={20} value={form.nationalId} onChange={(v) => set({ nationalId: v })} autoFocus error={shown ? errors.nationalId : undefined} />
      <DialogText label="KRA PIN" mono value={form.kraPin} onChange={(v) => set({ kraPin: v })} error={shown ? errors.kraPin : undefined} />
      <DialogText label="NSSF number" mono value={form.nssfNumber} onChange={(v) => set({ nssfNumber: v })} error={shown ? errors.nssfNumber : undefined} />
      <DialogText label="SHA number" mono value={form.shaNumber} onChange={(v) => set({ shaNumber: v })} error={shown ? errors.shaNumber : undefined} />
      <DialogText label="HELB number" mono hint="optional" value={form.helbNumber} onChange={(v) => set({ helbNumber: v })} />
      <DialogPicker
        label="Bank"
        value={bankValue}
        placeholder="Choose your bank"
        options={[...KENYAN_BANKS, OTHER_BANK].map((b) => ({ value: b, label: b }))}
        onChange={(v) => {
          n.setOtherBank(v === OTHER_BANK);
          set({ bankName: v === OTHER_BANK ? '' : v });
        }}
        error={shown ? errors.bankName : undefined}
      />
      {n.otherBank ? <DialogText label="Name of your bank" value={form.bankName} onChange={(v) => set({ bankName: v })} /> : null}
      <DialogDigits label="Account number" maxLength={20} value={form.accountNumber} onChange={(v) => set({ accountNumber: v })} error={shown ? errors.accountNumber : undefined} />
      <DialogError message={n.error} />
    </KitDialog>
  );
}
