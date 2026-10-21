'use client';

import * as React from 'react';

import { ChoiceChips, DialogButton, KitDialog } from '../../../_shared';
import { peopleWrites } from '../../_shared/services/people-writes';
import { DialogError, DialogText, FooterNote } from '../../file/components/dialogs/dialog-fields';
import { useFileAction } from '../../file/hooks/use-file-action';
import { RELATIONS, toEmergencyBody, validateEmergency, type EmergencyForm } from '../lib/own-file';

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
