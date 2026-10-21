'use client';

import * as React from 'react';

import { DialogButton, KitDialog } from '../../../_shared';
import { KENYAN_BANKS, OTHER_BANK, isListedBank } from '../../_shared/lib/kenyan-banks';
import { peopleWrites } from '../../_shared/services/people-writes';
import type { EmployeeFile } from '../../_shared/types/people-types';
import { DialogError, DialogPicker, DialogText, FooterNote } from '../../file/components/dialogs/dialog-fields';
import { useFileAction } from '../../file/hooks/use-file-action';
import { ownNumbersBody, ownNumbersFrom, touchesBank, validateOwnNumbers, type OwnNumbersForm } from '../lib/own-numbers';

/**
 * Edit my IDs and bank (frames 8.1 to 8.3). The person changes their own National ID, KRA PIN, NSSF, SHA, HELB, bank and account at
 * any time. It saves at once; HR does not re-check. A bank or account change tells the Accountant (the server does that).
 */
export function OwnNumbersDialog({ file, onClose, done }: { file: Pick<EmployeeFile, 'sensitive'>; onClose: () => void; done: (message: string) => void }) {
  const onFile = React.useMemo(() => ownNumbersFrom(file.sensitive), [file.sensitive]);
  const [form, setForm] = React.useState<OwnNumbersForm>(onFile);
  const [otherBank, setOtherBank] = React.useState(() => onFile.bankName !== '' && !isListedBank(onFile.bankName));
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Saved.'));
  const set = (patch: Partial<OwnNumbersForm>): void => setForm((f) => ({ ...f, ...patch }));
  const errors = validateOwnNumbers(form);
  const body = ownNumbersBody(form, onFile);
  const changed = Object.keys(body).length > 0;
  const save = (): void => {
    setShown(true);
    if (Object.keys(errors).length > 0 || !changed) return;
    void action.run(() => peopleWrites.patchMe(body), 'Saved.');
  };
  const bankValue = otherBank ? OTHER_BANK : form.bankName;
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Edit my IDs and bank"
      description="Only you and HR see these. Changes save at once."
      width={440}
      busy={action.busy}
      footer={
        <>
          {touchesBank(body) ? <FooterNote>The Accountant is told that your bank changed.</FooterNote> : null}
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={save} disabled={action.busy || !changed}>{action.busy ? 'Saving…' : 'Save'}</DialogButton>
        </>
      }
    >
      <DialogText label="National ID" mono value={form.nationalId} onChange={(v) => set({ nationalId: v })} autoFocus error={shown ? errors.nationalId : undefined} />
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
          setOtherBank(v === OTHER_BANK);
          set({ bankName: v === OTHER_BANK ? '' : v });
        }}
        error={shown ? errors.bankName : undefined}
      />
      {otherBank ? <DialogText label="Name of your bank" value={form.bankName} onChange={(v) => set({ bankName: v })} /> : null}
      <DialogText label="Account number" mono value={form.accountNumber} onChange={(v) => set({ accountNumber: v })} error={shown ? errors.accountNumber : undefined} />
      <DialogError message={action.error} />
    </KitDialog>
  );
}
