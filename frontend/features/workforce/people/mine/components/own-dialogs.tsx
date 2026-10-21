'use client';

import * as React from 'react';

import { ChoiceChips, DialogButton, KitDialog } from '../../../_shared';
import { KENYAN_BANKS, OTHER_BANK, isListedBank } from '../../_shared/lib/kenyan-banks';
import { nssfError, onFileEnding, shaError } from '../../_shared/lib/statutory-formats';
import { peopleWrites } from '../../_shared/services/people-writes';
import type { EmployeeFile } from '../../_shared/types/people-types';
import { DialogError, DialogPicker, DialogText, FooterNote } from '../../file/components/dialogs/dialog-fields';
import { useFileAction } from '../../file/hooks/use-file-action';
import { RELATIONS, idBankEmpty, numbersEmpty, toEmergencyBody, toIdBankBody, toNumbersBody, validateEmergency, validateIdBank, type EmergencyForm, type IdBankForm, type NumbersForm } from '../lib/own-file';

interface OwnDialogProps {
  onClose: () => void;
  done: (message: string) => void;
}

/** Emergency contact (Paper `12UL-0`): their name, how they are related to you, their phone. Saving clears the gap on your file. */
export function EmergencyDialog({ onClose, done }: OwnDialogProps) {
  const [form, setForm] = React.useState<EmergencyForm>({ name: '', relation: '', phone: '' });
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Saved.'));
  const errors = validateEmergency(form);
  const save = (): void => {
    setShown(true);
    if (Object.keys(errors).length > 0) return;
    void action.run(() => peopleWrites.patchMe(toEmergencyBody(form)), 'Your emergency contact is saved.');
  };
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Emergency contact"
      description="Only HR and your manager can see it, and only if they need it."
      width={440}
      busy={action.busy}
      footer={
        <>
          <FooterNote>Opening this later is written to the audit log.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={save} disabled={action.busy}>{action.busy ? 'Saving…' : 'Save'}</DialogButton>
        </>
      }
    >
      <DialogText label="Their name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} error={shown ? errors.name : undefined} autoFocus />
      <ChoiceChips legend="How are they related to you?" value={form.relation || null} onChange={(v) => setForm((f) => ({ ...f, relation: v }))} options={RELATIONS.map((r) => ({ value: r, label: r }))} />
      {shown && errors.relation ? <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">{errors.relation}</p> : null}
      <DialogText label="Their phone number" type="tel" mono value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} error={shown ? errors.phone : undefined} />
      <DialogError message={action.error} />
    </KitDialog>
  );
}

/** National ID, bank and account number (finding 15, Q2): you may enter them yourself; HR verifies, and after that only HR changes them. */
export function IdBankDialog({ onClose, done }: OwnDialogProps) {
  const [form, setForm] = React.useState<IdBankForm>({ nationalId: '', bank: '', accountNumber: '' });
  const [otherBank, setOtherBank] = React.useState(false);
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Saved.'));
  const errors = validateIdBank(form);
  const save = (): void => {
    setShown(true);
    if (Object.keys(errors).length > 0) return;
    void action.run(() => peopleWrites.patchMe(toIdBankBody(form)), 'Saved. HR will check your ID and bank details.');
  };
  const picked = otherBank ? OTHER_BANK : form.bank;
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Your ID and bank details"
      description="Only you and HR see these. HR checks them before they are used for pay; after that, ask HR to change them."
      width={440}
      busy={action.busy}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={save} disabled={action.busy || idBankEmpty(form)}>{action.busy ? 'Saving…' : 'Save'}</DialogButton>
        </>
      }
    >
      <DialogText label="National ID number" mono value={form.nationalId} onChange={(v) => setForm((f) => ({ ...f, nationalId: v }))} autoFocus helper="Leave empty to keep the one on file." error={shown ? errors.nationalId : undefined} />
      <DialogPicker
        label="Bank"
        value={isListedBank(form.bank) ? form.bank : picked}
        placeholder="Choose your bank"
        options={[...KENYAN_BANKS, OTHER_BANK].map((b) => ({ value: b, label: b }))}
        onChange={(v) => {
          setOtherBank(v === OTHER_BANK);
          setForm((f) => ({ ...f, bank: v === OTHER_BANK ? '' : v }));
        }}
        error={shown ? errors.bank : undefined}
      />
      {otherBank ? <DialogText label="Name of your bank" value={form.bank} onChange={(v) => setForm((f) => ({ ...f, bank: v }))} /> : null}
      <DialogText label="Account number" mono value={form.accountNumber} onChange={(v) => setForm((f) => ({ ...f, accountNumber: v }))} error={shown ? errors.accountNumber : undefined} />
      <DialogError message={action.error} />
    </KitDialog>
  );
}

/** NSSF and SHA numbers: add what you have; HR checks them before they are used for pay. */
export function NumbersDialog({ file, onClose, done }: OwnDialogProps & { file: Pick<EmployeeFile, 'sensitive'> }) {
  const [form, setForm] = React.useState<NumbersForm>({ nssf: '', sha: '' });
  const [shown, setShown] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Saved.'));
  // A number already on file shows only its ending, and replacing it needs a tick (finding 65).
  const nssfOnFile = onFileEnding(file.sensitive.nssfNumber);
  const shaOnFile = onFileEnding(file.sensitive.shaNumber);
  const replacing = (form.nssf.trim() !== '' && nssfOnFile !== null) || (form.sha.trim() !== '' && shaOnFile !== null);
  const errors = { nssf: nssfError(form.nssf), sha: shaError(form.sha) };
  const save = (): void => {
    setShown(true);
    if (errors.nssf || errors.sha || (replacing && !confirmed)) return;
    void action.run(() => peopleWrites.patchMe(toNumbersBody(form)), 'Your numbers are saved. HR will check them.');
  };
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Your numbers"
      description="Only you and HR see these. HR checks them before they are used for pay."
      width={440}
      busy={action.busy}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" disabled={action.busy || numbersEmpty(form)} onClick={save}>{action.busy ? 'Saving…' : 'Save and continue'}</DialogButton>
        </>
      }
    >
      <DialogText label="NSSF number" mono value={form.nssf} onChange={(v) => setForm((f) => ({ ...f, nssf: v }))} autoFocus helper={nssfOnFile ?? undefined} error={shown ? (errors.nssf ?? undefined) : undefined} />
      <DialogText label="SHA number" mono value={form.sha} onChange={(v) => setForm((f) => ({ ...f, sha: v }))} helper={shaOnFile ?? 'Not sure? Skip, and HR will help.'} error={shown ? (errors.sha ?? undefined) : undefined} />
      {replacing ? (
        <label className="flex items-start gap-2 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
          I want to replace the number on file with this one.
        </label>
      ) : null}
      {shown && replacing && !confirmed ? <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">Tick the box to replace the number on file.</p> : null}
      <DialogError message={action.error} />
    </KitDialog>
  );
}
