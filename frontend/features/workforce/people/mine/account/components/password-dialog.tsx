'use client';

import * as React from 'react';

import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { formatApiErrorMessage } from '@/types/api';

import { DialogButton, FIELD_CLASS, FormField, KitDialog } from '../../../../_shared';
import { checkPasswordChange } from '../lib/account-words';

function PasswordField({ label, helper, error, value, onChange, autoComplete }: { label: string; helper?: string; error?: string | undefined; value: string; onChange: (v: string) => void; autoComplete: string }) {
  return (
    <FormField label={label} {...(helper ? { helper } : {})} error={error}>
      {(ids) => <input id={ids.id} aria-describedby={ids.describedBy} aria-invalid={ids.invalid} type="password" autoComplete={autoComplete} className={FIELD_CLASS} value={value} onChange={(e) => onChange(e.target.value)} />}
    </FormField>
  );
}

/** Change my password (the Password row of "Sign-in and alerts"): the current one once, then the new one twice. Uses the same server step the old Profile page used. */
export function PasswordDialog({ onClose }: { onClose: () => void }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [v, setV] = React.useState({ current: '', next: '', again: '' });
  const [shown, setShown] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const errors = checkPasswordChange(v);

  const save = async (): Promise<void> => {
    setShown(true);
    if (Object.keys(errors).length > 0 || !accessToken) return;
    setBusy(true);
    setError(null);
    try {
      await authService.changePassword({ currentPassword: v.current, newPassword: v.next }, accessToken);
      setSaved(true);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'We could not change your password. Nothing was changed. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Change your password"
      description={saved ? undefined : 'You stay signed in on this device.'}
      width={440}
      busy={busy}
      footer={
        saved ? (
          <DialogButton kind="primary" size="lg" onClick={onClose}>Done</DialogButton>
        ) : (
          <>
            <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={busy}>Cancel</DialogButton>
            <DialogButton kind="primary" size="lg" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save password'}</DialogButton>
          </>
        )
      }
    >
      {saved ? (
        <p role="status" className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-ink">Your password is changed.</p>
      ) : (
        <>
          <PasswordField label="Your current password" autoComplete="current-password" value={v.current} onChange={(x) => setV((p) => ({ ...p, current: x }))} error={shown ? errors.current : undefined} />
          <PasswordField label="New password" helper="At least 8 characters" autoComplete="new-password" value={v.next} onChange={(x) => setV((p) => ({ ...p, next: x }))} error={shown ? errors.next : undefined} />
          <PasswordField label="Say it again" autoComplete="new-password" value={v.again} onChange={(x) => setV((p) => ({ ...p, again: x }))} error={shown ? errors.again : undefined} />
          {error ? <p role="alert" className="m-0 font-wds-sans text-[13px] leading-5 text-wds-error-fg">{error}</p> : null}
        </>
      )}
    </KitDialog>
  );
}
