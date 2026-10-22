'use client';

import * as React from 'react';

import { ChoiceChips, DialogButton, KitDialog } from '../../../_shared';
import { peopleWrites } from '../../_shared/services/people-writes';
import type { PatchMeBody } from '../../_shared/types/people-requests';
import type { EmployeeFile } from '../../_shared/types/people-types';
import { DialogDigits, DialogError, DialogText, FooterNote } from '../../file/components/dialogs/dialog-fields';
import { useFileAction } from '../../file/hooks/use-file-action';
import { RELATIONS, toEmergencyBody, validateEmergency, type EmergencyForm } from '../lib/own-file';

/**
 * Your contact (the Edit of the "Your contact" card, frame 8.2): your own phone and the emergency contact. A box left empty is left
 * alone; the emergency contact is saved only when its name, relation and phone are all there.
 */
export function OwnContactDialog({ file, onClose, done }: { file: Pick<EmployeeFile, 'personalPhone' | 'emergencyContact'>; onClose: () => void; done: (message: string) => void }) {
  const [phone, setPhone] = React.useState(file.personalPhone ?? '');
  const [form, setForm] = React.useState<EmergencyForm>({ name: file.emergencyContact?.name ?? '', relation: file.emergencyContact?.relation ?? '', phone: file.emergencyContact?.phone ?? '' });
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Saved.'));
  const touched = form.name.trim() !== '' || form.relation !== '' || form.phone.trim() !== '';
  const errors = touched ? validateEmergency(form) : {};
  const phoneError = phone !== '' && phone.replace(/\D/g, '').length < 9 ? 'Enter a phone number such as 0712 345 678.' : undefined;
  const save = (): void => {
    setShown(true);
    if (Object.keys(errors).length > 0 || phoneError) return;
    const body: PatchMeBody = { ...(phone !== (file.personalPhone ?? '') && phone !== '' ? { personalPhone: phone } : {}), ...(touched ? toEmergencyBody(form) : {}) };
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    void action.run(() => peopleWrites.patchMe(body), 'Saved. Your file is updated.');
  };
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Your contact"
      description="Only HR and your manager can see these, and only if they need them."
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
      <DialogDigits label="Your phone" value={phone} onChange={setPhone} error={shown ? phoneError : undefined} autoFocus />
      <DialogText label="Emergency contact" hint="optional" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} error={shown ? errors.name : undefined} />
      <ChoiceChips legend="How are they related to you?" value={form.relation || null} onChange={(v) => setForm((f) => ({ ...f, relation: v }))} options={RELATIONS.map((r) => ({ value: r, label: r }))} />
      {shown && errors.relation ? <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">{errors.relation}</p> : null}
      <DialogDigits label="Their phone number" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} error={shown ? errors.phone : undefined} />
      <DialogError message={action.error} />
    </KitDialog>
  );
}
