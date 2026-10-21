'use client';

import * as React from 'react';

import { Callout, FIELD_CLASS, FormField, PhoneButton, PhoneDarkHeader } from '../../_shared';
import { usePasswordReset } from '../hooks/use-password-reset';
import { checkPasswords, WASNT_ME_COPY } from '../lib/security-words';

/**
 * "We signed you out everywhere" (Paper Chapter 14 step 4, right phone): the green card, the new password twice, Save and sign in. It blocks
 * the app while a new password is required. `needsCurrent` adds a "Your current password" field (beyond Paper) for the person who has
 * just pressed "This wasn't me" on this phone: their sign-in ended, so the app needs the current password once to let them choose the
 * new one. There is no lockout here: a wrong entry is a message under the field.
 */
export function ResetPasswordScreen({ email, needsCurrent, onDone }: { email: string; needsCurrent: boolean; onDone: () => void }) {
  const [current, setCurrent] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [again, setAgain] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const reset = usePasswordReset(email, needsCurrent, onDone);
  const checks = checkPasswords(password, again);
  const ready = password !== '' && again !== '' && !checks.newPassword && !checks.confirm && (!needsCurrent || current !== '');

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    setTouched(true);
    if (ready) void reset.save(current, password, again);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="reset-title" className="flex min-h-screen flex-col bg-wds-canvas">
      <PhoneDarkHeader kicker="WENDO RMS" />
      <main className="mx-auto flex w-full max-w-[480px] flex-col gap-4 px-4 py-6">
        <Callout tone="success" variant="bar" title={WASNT_ME_COPY.doneTitle}>
          {WASNT_ME_COPY.doneLine}
        </Callout>
        <h1 id="reset-title" className="sr-only">
          Choose a new password
        </h1>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {needsCurrent ? (
            <FormField label={WASNT_ME_COPY.currentLabel} helper={WASNT_ME_COPY.currentHelp} error={reset.error?.field === 'current' ? reset.error.message : undefined}>
              {(ids) => (
                <input id={ids.id} aria-describedby={ids.describedBy} aria-invalid={ids.invalid} type="password" autoComplete="current-password" className={FIELD_CLASS} value={current} onChange={(e) => setCurrent(e.target.value)} />
              )}
            </FormField>
          ) : null}
          <FormField label={WASNT_ME_COPY.newLabel} helper={WASNT_ME_COPY.newHelp} error={touched ? (checks.newPassword ?? undefined) : undefined}>
            {(ids) => (
              <input id={ids.id} aria-describedby={ids.describedBy} aria-invalid={ids.invalid} type="password" autoComplete="new-password" className={FIELD_CLASS} value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
          </FormField>
          <FormField label={WASNT_ME_COPY.againLabel} error={checks.confirm ?? undefined}>
            {(ids) => (
              <input id={ids.id} aria-describedby={ids.describedBy} aria-invalid={ids.invalid} type="password" autoComplete="new-password" className={FIELD_CLASS} value={again} onChange={(e) => setAgain(e.target.value)} />
            )}
          </FormField>
          {reset.error?.field === 'password' ? (
            <p role="alert" className="m-0 font-wds-sans text-[13px] leading-5 text-wds-error-fg">
              {reset.error.message}
            </p>
          ) : null}
          <PhoneButton type="submit" kind="primary" disabled={reset.busy || (touched && !ready)}>
            {reset.busy ? 'Saving…' : WASNT_ME_COPY.save}
          </PhoneButton>
        </form>
      </main>
    </div>
  );
}
