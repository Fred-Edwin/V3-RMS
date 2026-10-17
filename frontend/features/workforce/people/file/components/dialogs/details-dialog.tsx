'use client';

import * as React from 'react';

import { DialogButton, KitDialog } from '../../../../_shared';
import { peopleWrites } from '../../../_shared/services/people-writes';
import type { UpdateEmployeeBody } from '../../../_shared/types/people-requests';
import { useFileAction } from '../../hooks/use-file-action';
import { firstName } from '../../lib/file-model';
import { DialogError, DialogText, FooterNote } from './dialog-fields';
import type { FileDialogProps } from './file-dialogs';

interface DetailsForm {
  personalPhone: string;
  personalEmail: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  nationalId: string;
  kraPin: string;
  nssfNumber: string;
  shaNumber: string;
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

/** "Finish the file" for identity, statutory and emergency details (W6 sensitive fields). The server refuses what the viewer may not change, in words. */
export function DetailsDialog({ file, onClose, done }: FileDialogProps) {
  const [form, setForm] = React.useState<DetailsForm>({
    personalPhone: '', personalEmail: '', emergencyName: file.emergencyContact?.name ?? '', emergencyRelation: file.emergencyContact?.relation ?? '', emergencyPhone: file.emergencyContact?.phone ?? '',
    nationalId: '', kraPin: '', nssfNumber: '', shaNumber: '',
  });
  const action = useFileAction((m) => done(m ?? 'Details saved.'));
  const set = (patch: Partial<DetailsForm>): void => setForm((f) => ({ ...f, ...patch }));
  const body = detailsBody(form);
  const empty = Object.keys(body).length === 0;
  const first = firstName(file.name);
  const sensitive = !file.locked.includes('ids');
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
        <DialogText label="Phone" type="tel" value={form.personalPhone} onChange={(v) => set({ personalPhone: v })} helper={file.personalPhone ? `On file: ${file.personalPhone}` : undefined} />
        <DialogText label="Personal email" type="email" value={form.personalEmail} onChange={(v) => set({ personalEmail: v })} hint="optional" />
        <DialogText label="Emergency contact" value={form.emergencyName} onChange={(v) => set({ emergencyName: v })} />
        <DialogText label="Relation" value={form.emergencyRelation} onChange={(v) => set({ emergencyRelation: v })} hint="optional" />
        <DialogText label="Emergency phone" type="tel" value={form.emergencyPhone} onChange={(v) => set({ emergencyPhone: v })} />
      </div>
      {sensitive ? (
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <DialogText label="National ID" mono value={form.nationalId} onChange={(v) => set({ nationalId: v })} helper={file.sensitive['nationalId'] ? `On file: ${file.sensitive['nationalId']}` : undefined} />
          <DialogText label="KRA PIN" mono value={form.kraPin} onChange={(v) => set({ kraPin: v })} />
          <DialogText label="NSSF number" mono value={form.nssfNumber} onChange={(v) => set({ nssfNumber: v })} />
          <DialogText label="SHA number" mono value={form.shaNumber} onChange={(v) => set({ shaNumber: v })} />
        </div>
      ) : null}
      <DialogError message={action.error} />
    </KitDialog>
  );
}
