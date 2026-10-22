'use client';

import * as React from 'react';

import { DialogButton, KitDialog } from '../../../../_shared';
import { peopleWrites } from '../../../_shared/services/people-writes';
import type { UpdateEmployeeBody } from '../../../_shared/types/people-requests';
import { useFileAction } from '../../hooks/use-file-action';
import { firstName } from '../../lib/file-model';
import { DialogDigits, DialogError, DialogText, FooterNote } from './dialog-fields';
import type { FileDialogProps } from './file-dialogs';

interface DetailsForm {
  personalPhone: string;
  personalEmail: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
}

/** Only what was typed is sent. A blank box leaves the stored value alone (a masked ID is never sent back). */
export function detailsBody(f: DetailsForm): UpdateEmployeeBody {
  const body: UpdateEmployeeBody = {};
  (Object.keys(f) as (keyof DetailsForm)[]).forEach((k) => {
    const v = f[k].trim();
    if (v !== '') body[k] = v;
  });
  return body;
}

/** Phone, personal email and emergency contact. The IDs and the bank have their own dialog (`ids-bank-dialog`). */
export function DetailsDialog({ file, onClose, done }: FileDialogProps) {
  const [form, setForm] = React.useState<DetailsForm>({
    personalPhone: '', personalEmail: '', emergencyName: file.emergencyContact?.name ?? '', emergencyRelation: file.emergencyContact?.relation ?? '', emergencyPhone: file.emergencyContact?.phone ?? '',
  });
  const action = useFileAction((m) => done(m ?? 'Details saved.'));
  const set = (patch: Partial<DetailsForm>): void => setForm((f) => ({ ...f, ...patch }));
  const body = detailsBody(form);
  const empty = Object.keys(body).length === 0;
  const first = firstName(file.name);
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${first}'s details`}
      description="Fill what you have. A blank box leaves what is on file as it is."
      busy={action.busy}
      footer={
        <>
          <FooterNote>Logged with before and after.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" disabled={action.busy || empty} onClick={() => void action.run(() => peopleWrites.update(file.id, body), 'Details saved.')}>{action.busy ? 'Saving…' : 'Save details'}</DialogButton>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <DialogDigits label="Phone" value={form.personalPhone} onChange={(v) => set({ personalPhone: v })} helper={file.personalPhone ? `On file: ${file.personalPhone}` : undefined} />
        <DialogText label="Personal email" type="email" value={form.personalEmail} onChange={(v) => set({ personalEmail: v })} hint="optional" />
        <DialogText label="Emergency contact" value={form.emergencyName} onChange={(v) => set({ emergencyName: v })} />
        <DialogText label="Relation" value={form.emergencyRelation} onChange={(v) => set({ emergencyRelation: v })} hint="optional" />
        <DialogDigits label="Emergency phone" value={form.emergencyPhone} onChange={(v) => set({ emergencyPhone: v })} />
      </div>
      <DialogError message={action.error} />
    </KitDialog>
  );
}
