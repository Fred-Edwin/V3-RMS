'use client';

import * as React from 'react';

import { DialogButton, KitDialog } from '../../../../_shared';
import { KENYAN_BANKS, OTHER_BANK, isListedBank } from '../../../_shared/lib/kenyan-banks';
import { onFileEnding } from '../../../_shared/lib/statutory-formats';
import { peopleWrites } from '../../../_shared/services/people-writes';
import { useFileAction } from '../../hooks/use-file-action';
import { firstName } from '../../lib/file-model';
import { EMPTY_IDS_BANK, bankBody, bankIsChanging, idsBankErrors, idsBody, nothingTyped, type IdsBankForm } from '../../lib/ids-bank-form';
import { DialogError, DialogPicker, DialogText, DialogTextArea, FooterNote } from './dialog-fields';
import type { FileDialogProps } from './file-dialogs';

/**
 * Edit IDs and bank (Paper frame 7.2). HR and above change the five numbers and the bank; the Accountant's Edit is the bank and account
 * only. A blank box leaves what is on file alone. A bank or account change asks for a reason and tells the Accountant.
 */
export function IdsBankDialog({ file, onClose, done }: FileDialogProps) {
  const showIds = file.actions.editIds && !file.locked.includes('ids');
  const showBank = file.actions.editBank && !file.locked.includes('bank');
  const onFileBank = file.sensitive['bankName'] ?? null;
  const [form, setForm] = React.useState<IdsBankForm>(EMPTY_IDS_BANK);
  const [otherBank, setOtherBank] = React.useState(false);
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Saved.'));
  const set = (patch: Partial<IdsBankForm>): void => setForm((f) => ({ ...f, ...patch }));
  const errors = idsBankErrors(form, { ids: showIds }, onFileBank, Boolean(file.sensitive['accountNumber']));
  const changing = showBank && bankIsChanging(form, onFileBank);
  const first = firstName(file.name);

  const save = (): void => {
    setShown(true);
    if (Object.keys(errors).length > 0 || nothingTyped(form)) return;
    const ids = showIds ? idsBody(form) : {};
    const bank = showBank ? bankBody(form) : null;
    void action.run(async () => {
      if (Object.keys(ids).length > 0) await peopleWrites.update(file.id, ids);
      if (bank) await peopleWrites.updatePayProfile(file.id, bank);
    }, `${first}'s ${showIds ? 'IDs and bank' : 'bank details'} are saved.`);
  };

  const bankValue = form.bankName === '' ? '' : otherBank || !isListedBank(form.bankName) ? OTHER_BANK : form.bankName;
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={showIds ? 'Edit IDs and bank' : 'Edit bank'}
      description={`${file.name}. Leave a box empty to keep what is on file.`}
      busy={action.busy}
      footer={
        <>
          <FooterNote>Logged with before and after. Numbers are never written in clear.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={save} disabled={action.busy}>{action.busy ? 'Saving…' : 'Save changes'}</DialogButton>
        </>
      }
    >
      {showIds ? (
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <DialogText label="National ID" mono value={form.nationalId} onChange={(v) => set({ nationalId: v })} helper={onFileEnding(file.sensitive['nationalId']) ?? undefined} autoFocus />
          <DialogText label="KRA PIN" mono value={form.kraPin} onChange={(v) => set({ kraPin: v })} helper={onFileEnding(file.sensitive['kraPin']) ?? undefined} error={shown ? errors.kraPin : undefined} />
          <DialogText label="NSSF number" mono value={form.nssfNumber} onChange={(v) => set({ nssfNumber: v })} helper={onFileEnding(file.sensitive['nssfNumber']) ?? undefined} error={shown ? errors.nssfNumber : undefined} />
          <DialogText label="SHA number" mono value={form.shaNumber} onChange={(v) => set({ shaNumber: v })} helper={onFileEnding(file.sensitive['shaNumber']) ?? undefined} error={shown ? errors.shaNumber : undefined} />
          <DialogText label="HELB number" mono hint="optional" value={form.helbNumber} onChange={(v) => set({ helbNumber: v })} helper="Leave empty if there is none." />
        </div>
      ) : null}
      {showBank ? (
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <DialogPicker
            label="Bank"
            value={bankValue}
            placeholder={onFileBank ?? 'Choose the bank'}
            options={[...KENYAN_BANKS, OTHER_BANK].map((b) => ({ value: b, label: b }))}
            onChange={(v) => {
              setOtherBank(v === OTHER_BANK);
              set({ bankName: v === OTHER_BANK ? '' : v });
            }}
          />
          {otherBank ? <DialogText label="Name of the bank" value={form.bankName} onChange={(v) => set({ bankName: v })} /> : null}
          <DialogText label="Account number" mono value={form.accountNumber} onChange={(v) => set({ accountNumber: v })} helper={onFileEnding(file.sensitive['accountNumber']) ?? undefined} />
        </div>
      ) : null}
      {changing ? (
        <>
          <DialogTextArea label="Reason for change" hint="required" value={form.reason} onChange={(v) => set({ reason: v })} rows={2} error={shown ? errors.reason : undefined} />
          <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">The Accountant will be told. The change is saved in the audit log.</p>
        </>
      ) : null}
      <DialogError message={action.error} />
    </KitDialog>
  );
}
