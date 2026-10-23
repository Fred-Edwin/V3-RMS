'use client';

import * as React from 'react';

import { useAuthStore } from '@/store/authStore';

import { DialogButton, KitDialog } from '../../_shared';
import { SIGN_OUT_EVERYWHERE_COPY } from '../lib/security-words';
import { newKey, sessionWrites } from '../services/security-services';
import { ResetPasswordScreen } from './reset-password-screen';

/**
 * "Sign out everywhere" on My file (frames 13.3 and 13.14): the person is asked once, then every phone and computer signed in as them
 * ends. It is the same server step as "This wasn't me" in Activity on my record, so the same things follow: a new password and a new
 * code, and the System Admin is told. This device then goes straight to the password page, so nobody is left on a dead sign-in.
 */
export function SignOutEverywhereDialog({ onClose }: { onClose: () => void }) {
  const email = useAuthStore((s) => s.user?.email ?? '');
  const [key] = React.useState(newKey);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pressed, setPressed] = React.useState(false);

  if (pressed) return <ResetPasswordScreen email={email} needsCurrent onDone={() => window.location.assign('/app/workforce')} />;

  const press = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await sessionWrites.wasntMe(key);
      setPressed(true);
    } catch {
      setError(SIGN_OUT_EVERYWHERE_COPY.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={SIGN_OUT_EVERYWHERE_COPY.title}
      description={SIGN_OUT_EVERYWHERE_COPY.intro}
      width={480}
      busy={busy}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={busy}>Cancel</DialogButton>
          <DialogButton kind="danger" size="lg" onClick={() => void press()} disabled={busy}>{busy ? 'Signing you out…' : SIGN_OUT_EVERYWHERE_COPY.confirm}</DialogButton>
        </>
      }
    >
      <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 font-wds-sans text-[14px] leading-5 text-wds-text-ink">
        {SIGN_OUT_EVERYWHERE_COPY.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      {error ? <p role="alert" className="m-0 font-wds-sans text-[13px] leading-5 text-wds-error-fg">{error}</p> : null}
    </KitDialog>
  );
}
