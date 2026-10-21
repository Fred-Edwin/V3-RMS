'use client';

import * as React from 'react';

import { ChoiceChips, DialogButton, KitDialog } from '../../../_shared';
import { nssfError, onFileEnding, shaError } from '../../_shared/lib/statutory-formats';
import { peopleWrites } from '../../_shared/services/people-writes';
import type { EmployeeFile } from '../../_shared/types/people-types';
import { DialogError, DialogText, FooterNote } from '../../file/components/dialogs/dialog-fields';
import { useFileAction } from '../../file/hooks/use-file-action';
import { RELATIONS, numbersEmpty, toEmergencyBody, toNumbersBody, validateEmergency, type EmergencyForm, type NumbersForm } from '../lib/own-file';

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
      description="Only HR and your Branch Manager can see it, and only if they need it."
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
