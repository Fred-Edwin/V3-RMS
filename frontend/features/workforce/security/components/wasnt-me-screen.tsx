'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';

import { Callout, PhoneButton, PhoneScreen } from '../../_shared';
import { WASNT_ME_COPY } from '../lib/security-words';
import { newKey, sessionWrites } from '../services/security-services';
import { ResetPasswordScreen } from './reset-password-screen';

/**
 * "Payslip opened" with the "This wasn't me?" card (Paper Chapter 14 step 4, middle phone). Pressing the red button ends every session,
 * clears the code, and tells the System Admin, in one step on the server; this phone then asks for a new password
 * (`ResetPasswordScreen`, which needs the current password once because the sign-in just ended). "That was me" changes nothing.
 * The facts of the opening (phone, place, time) live in Activity on my record, which comes with the next front-end session.
 */
export function WasntMeScreen({ entryId }: { entryId?: string }) {
  const router = useRouter();
  const email = useAuthStore((s) => s.user?.email ?? '');
  const [key] = React.useState(newKey);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pressed, setPressed] = React.useState(false);

  if (pressed) {
    return <ResetPasswordScreen email={email} needsCurrent onDone={() => window.location.assign('/app/workforce')} />;
  }

  const press = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await sessionWrites.wasntMe(key, entryId);
      setPressed(true);
    } catch {
      setError('We could not do that. Nothing was changed. Check your signal and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PhoneScreen screen="Payslip opened" kicker="PAY · PAYSLIP OPENED" back="/app/workforce/my-payslips" heading="Payslip opened">
      <Callout tone="error" variant="bar" kicker="PROBLEM" title="A payslip was opened on a phone you have not confirmed">
        If it was you, press That was me. If not, press Yes, this wasn&apos;t me below.
      </Callout>
      <section aria-labelledby="wasnt-me-title" className="flex flex-col gap-3 border border-wds-border bg-wds-surface px-4 py-4">
        <h2 id="wasnt-me-title" className="m-0 font-wds-sans text-[17px] font-semibold leading-[22px] text-wds-text-ink">
          {WASNT_ME_COPY.question}
        </h2>
        <p className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{WASNT_ME_COPY.intro}</p>
        <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 font-wds-sans text-[14px] leading-5 text-wds-text-ink">
          {WASNT_ME_COPY.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {error ? (
          <p role="alert" className="m-0 font-wds-sans text-[13px] leading-5 text-wds-error-fg">
            {error}
          </p>
        ) : null}
        <PhoneButton kind="primary" disabled={busy} onClick={() => void press()} className="!bg-wds-error-fg">
          {busy ? 'Signing you out…' : WASNT_ME_COPY.yes}
        </PhoneButton>
        <PhoneButton kind="outlined" disabled={busy} onClick={() => router.push('/app/workforce/my-phones')}>
          {WASNT_ME_COPY.no}
        </PhoneButton>
      </section>
    </PhoneScreen>
  );
}
