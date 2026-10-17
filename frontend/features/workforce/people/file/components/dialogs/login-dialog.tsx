'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';

import { DialogButton, KitDialog } from '../../../../_shared';
import { useEmailSuggestions } from '../../../_shared/hooks/use-email-suggestions';
import { useLookups } from '../../../_shared/hooks/use-people-data';
import { generateTemporaryPassword } from '../../../_shared/lib/temporary-password';
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
  const suggestions = useEmailSuggestions(file.name);
  const [form, setForm] = React.useState<LoginForm>({ email: file.personalEmail ?? '', loginRole: '', temporaryPassword: generateTemporaryPassword() });
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Login created.'));
  const first = firstName(file.name);
  const roles = lookups.data ? loginRolesFor(lookups.data) : [];
  const errors = validateLogin(form);

  React.useEffect(() => {
    if (form.email === '' && suggestions[0]) setForm((f) => (f.email === '' ? { ...f, email: suggestions[0] ?? '' } : f));
  }, [suggestions, form.email]);

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
      {suggestions.length > 0 ? (
        <div role="group" aria-label="Suggested sign-in emails" className="-mt-2 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} type="button" aria-pressed={form.email === s} onClick={() => setForm((f) => ({ ...f, email: s }))} className="h-7 border border-wds-border-strong px-2.5 font-wds-mono text-[12px] leading-4 text-wds-text-secondary outline-none focus-visible:shadow-wds-ring aria-pressed:border-wds-primary aria-pressed:bg-wds-caramel-100 aria-pressed:text-wds-text-ink">
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <DialogPicker label="Access" value={form.loginRole} onChange={(v) => setForm((f) => ({ ...f, loginRole: v }))} options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }))} error={shown ? errors.loginRole : undefined} />
      <div className="flex items-end gap-2">
        <DialogText label="Temporary password" mono value={form.temporaryPassword} onChange={(v) => setForm((f) => ({ ...f, temporaryPassword: v }))} helper={`Shown once. ${first} must change it, and set a PIN, the first time they sign in.`} error={shown ? errors.temporaryPassword : undefined} className="grow" />
        <Button type="button" variant="flat" className="mb-6 h-9 shrink-0" onClick={() => setForm((f) => ({ ...f, temporaryPassword: generateTemporaryPassword() }))}>Generate another</Button>
      </div>
      <DialogError message={action.error} />
    </KitDialog>
  );
}
