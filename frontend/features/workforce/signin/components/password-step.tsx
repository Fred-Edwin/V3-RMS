'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { cn } from '@/lib/cn';
import { pausedMessage, type SigninNotice } from '../lib/signin-rules';
import { PhoneSupport } from './phone-parts';
import { Heading, NoticeBar, PrimaryButton, SigninCard, StepMarker } from './signin-parts';

/**
 * Step 1, "Welcome back" (Paper 3.1, 4.5). A failure puts a coloured bar above the form and keeps what was typed; a wrong password
 * clears the password field and focuses it again. Accounts are never locked: a pause shows the seconds left and counts down.
 */

export interface PasswordStepProps {
  notice: SigninNotice | null;
  busy: boolean;
  online: boolean;
  /** Bumps each time the server answers a wrong password, so the field clears and takes focus again. */
  wrongCount: number;
  onSubmit: (email: string, password: string) => void;
  onRetryOffline: () => void;
}

/** The eye of Paper 3.1 and 4.5. It is crossed out while the password is showing (the button then hides it). */
function EyeIcon({ off }: { off: boolean }): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

const FIELD ='h-[52px] rounded-[2px] border bg-wds-surface px-3.5 text-[15px] font-normal text-wds-text-ink focus-visible:outline-none focus-visible:shadow-wds-ring lg:h-12 lg:text-sm';

export function PasswordStep({ notice, busy, online, wrongCount, onSubmit, onRetryOffline }: PasswordStepProps): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [left, setLeft] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);

  // A wrong password empties the field and puts the cursor back in it.
  useEffect(() => {
    if (wrongCount === 0) return;
    setPassword('');
    passwordRef.current?.focus();
  }, [wrongCount]);

  // The pause: count the seconds down on screen; the button comes back at zero.
  const waitSeconds = notice?.kind === 'paused' ? notice.waitSeconds ?? 0 : 0;
  useEffect(() => {
    setLeft(waitSeconds);
    if (waitSeconds <= 0) return;
    const timer = window.setInterval(() => setLeft((n) => (n <= 1 ? (window.clearInterval(timer), 0) : n - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [waitSeconds, notice]);

  const paused = notice?.kind === 'paused' && left > 0;
  const message = notice?.kind === 'paused' ? pausedMessage(left) : notice?.message;
  const wrong = notice?.kind === 'wrong';

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (paused || busy) return;
    onSubmit(email.trim(), password);
  };

  return (
    <SigninCard
      onSubmit={submit}
      top={
        <>
          <StepMarker current="password" />
          <Heading title="Welcome back" lead="Sign in to your account to continue." />
          {notice && message ? <NoticeBar kind={notice.kind}>{message}</NoticeBar> : null}
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium leading-4 text-wds-text-ink">
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                placeholder="firstname.secondname@wendo.co.ke"
                disabled={busy}
                className={cn(FIELD, 'border-wds-border-strong placeholder:text-wds-neutral-500 focus-visible:border-wds-espresso-700')}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium leading-4 text-wds-text-ink">
              Password
              <span className="relative flex">
                <input
                  ref={passwordRef}
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-invalid={wrong || undefined}
                  disabled={busy}
                  className={cn(FIELD, 'w-full pr-12', wrong ? 'border-[1.5px] border-wds-error-fg' : 'border-wds-border-strong focus-visible:border-wds-espresso-700')}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-pressed={show}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-[2px] text-[#8A5A16] hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:shadow-wds-ring"
                >
                  <EyeIcon off={show} />
                </button>
              </span>
            </label>
          </div>
        </>
      }
      bottom={
        <>
          <div className="flex flex-col gap-3 lg:gap-3.5">
            {online ? (
              <PrimaryButton type="submit" hint="Enter" busy={busy} disabled={paused || email.trim() === '' || password === ''}>
                {paused ? `Wait ${left}s` : 'Sign in'}
              </PrimaryButton>
            ) : (
              <button type="button" onClick={onRetryOffline} className="flex h-11 w-full items-center justify-center border border-wds-border-strong text-[14px] font-medium text-wds-text-ink hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:shadow-wds-ring">
                Try again
              </button>
            )}
            <p className="text-center text-[13px] leading-[19px] text-wds-text-secondary">Forgot your password? Ask your manager or HR for a new one.</p>
          </div>
          <PhoneSupport ruled />
        </>
      }
    />
  );
}
