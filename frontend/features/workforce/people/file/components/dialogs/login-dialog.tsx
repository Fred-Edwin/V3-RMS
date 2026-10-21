'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';

import { DialogButton, KitDialog } from '../../../../_shared';
import { useLookups } from '../../../_shared/hooks/use-people-data';
import { useSignInAddress } from '../../../_shared/hooks/use-sign-in-address';
import { peopleWrites } from '../../../_shared/services/people-writes';
import { loginRolesFor, ROLE_LABELS } from '../../../hire/lib/hire-choices';
import { useFileAction } from '../../hooks/use-file-action';
import { hasErrors, toLoginBody, validateLogin, type LoginForm } from '../../lib/dialog-forms';
import { firstName } from '../../lib/file-model';
import { DialogError, DialogPicker, DialogText, FooterNote } from './dialog-fields';
import type { FileDialogProps } from './file-dialogs';

/** Create a login (W24): the sign-in email, what the account may do, and a one-time password shown once. */
export function LoginDialog({ file, onClose, done }: FileDialogProps) {
  const lookups = useLookups();
  const suggested = useSignInAddress(file.name);
  const [form, setForm] = React.useState<LoginForm>({ email: '', loginRole: '', temporaryPassword: '' });
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  // The password is made by the server for this person (audited, never emailed); "Generate another" asks again.
  const newPassword = React.useCallback((): void => {
    setPasswordError(null);
    peopleWrites.newTemporaryPassword(file.id).then(
      (r) => setForm((f) => ({ ...f, temporaryPassword: r.password })),
      () => setPasswordError('We could not make a password just now. Try again.'),
    );
  }, [file.id]);
  React.useEffect(() => {
    newPassword();
  }, [newPassword]);
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Login created.'));
  const first = firstName(file.name);
  const roles = lookups.data ? loginRolesFor(lookups.data) : [];
  const errors = validateLogin(form);

  React.useEffect(() => {
    if (suggested) setForm((f) => (f.email === '' ? { ...f, email: suggested } : f));
  }, [suggested]);

  const create = (): void => {
    setShown(true);
    if (hasErrors(errors)) return;
    void action.run(() => peopleWrites.createLogin(file.id, toLoginBody(form)), `Login created for ${first}. The password was shown once: ${form.temporaryPassword}`);
  };
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Create ${first}'s login`}
      description="The account is separate from the job title. The password is shown once."
      busy={action.busy}
      footer={
        <>
          <FooterNote>Logged, with your name.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={create} disabled={action.busy}>{action.busy ? 'Creating…' : 'Create login'}</DialogButton>
        </>
      }
    >
      <DialogText label="Sign-in email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} error={shown ? errors.email : undefined} />
      <DialogPicker label="Login role" value={form.loginRole} onChange={(v) => setForm((f) => ({ ...f, loginRole: v }))} options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }))} error={shown ? errors.loginRole : undefined} />
      <div className="flex items-end gap-2">
        <DialogText label="Temporary password" mono value={form.temporaryPassword} onChange={(v) => setForm((f) => ({ ...f, temporaryPassword: v }))} helper={`Shown once. It stops working after 7 days if ${first} has not signed in. ${first} sets a PIN at the first sign-in.`} error={shown ? (errors.temporaryPassword ?? passwordError ?? undefined) : (passwordError ?? undefined)} className="grow" />
        <Button type="button" variant="flat" className="mb-6 h-9 shrink-0" onClick={newPassword}>Generate another</Button>
      </div>
      <DialogError message={action.error} />
    </KitDialog>
  );
}
