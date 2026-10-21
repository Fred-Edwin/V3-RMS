'use client';

import * as React from 'react';

import { KeyValueRows, PhoneButton, PhoneDarkHeader, useNow } from '../../_shared';
import { PHONE_COPY, placeWords, whenLabel } from '../lib/security-words';
import type { PhoneAnswer, Phone } from '../types/security-types';

/**
 * "Is this your phone?" (Paper Chapter 14 step 3, left phone). It blocks the app until answered: no skip, no back. "Yes" remembers the
 * phone; "Use it just once" counts for this visit only. The card shows what the server knows (phone, place, time); the screen never says
 * how a phone is recognised. A failed answer (no signal) says so and offers the same two buttons again; nobody is locked out.
 */
export function PhoneQuestionScreen({ phone, onAnswer }: { phone: Phone; onAnswer: (answer: PhoneAnswer) => Promise<void> }) {
  const now = useNow();
  const [busy, setBusy] = React.useState<PhoneAnswer | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const send = async (answer: PhoneAnswer): Promise<void> => {
    setBusy(answer);
    setError(null);
    try {
      await onAnswer(answer);
    } catch {
      setError('We could not save that. Check your signal and try again. Nothing was locked.');
      setBusy(null);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="phone-question-title" className="flex min-h-screen flex-col bg-wds-canvas">
      <PhoneDarkHeader kicker="WENDO RMS · SIGN IN" />
      <main className="mx-auto flex w-full max-w-[480px] flex-col gap-4 px-4 py-6">
        <div className="flex flex-col gap-1.5">
          <h1 id="phone-question-title" className="m-0 font-wds-sans text-[20px] font-semibold leading-[26px] text-wds-text-ink">
            {PHONE_COPY.questionTitle}
          </h1>
          <p className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{PHONE_COPY.questionLine}</p>
        </div>
        <div className="border border-wds-border bg-wds-surface px-4 py-1">
          <KeyValueRows
            topRule={false}
            aria-label="This phone"
            rows={[
              { label: 'Phone', value: phone.label },
              { label: 'Place', value: placeWords(phone.placeLabel) },
              { label: 'Time', value: whenLabel(phone.firstSeenAt, now), mono: true },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2.5">
          <PhoneButton autoFocus kind="primary" disabled={busy !== null} onClick={() => void send('REMEMBER')}>
            {busy === 'REMEMBER' ? 'Saving…' : PHONE_COPY.yes}
          </PhoneButton>
          <PhoneButton kind="outlined" disabled={busy !== null} onClick={() => void send('ONCE')}>
            {busy === 'ONCE' ? 'Saving…' : PHONE_COPY.once}
          </PhoneButton>
        </div>
        {error ? (
          <p role="alert" className="m-0 font-wds-sans text-[13px] leading-5 text-wds-error-fg">
            {error}
          </p>
        ) : null}
        <p className="m-0 font-wds-sans text-[12px] leading-[18px] text-wds-text-secondary">{PHONE_COPY.onceNote}</p>
      </main>
    </div>
  );
}
