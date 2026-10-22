'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { cn } from '@/lib/cn';
import { pausedMessage, type SigninNotice } from '../lib/signin-rules';
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
    <SigninCard>
      <StepMarker current="password" />
      <Heading title="Welcome back" lead="Sign in to your account to continue." />
      {notice && message ? <NoticeBar kind={notice.kind}>{message}</NoticeBar> : null}
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
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
            className="h-12 rounded-[2px] border border-wds-border-strong bg-wds-surface px-3.5 text-[14px] font-normal text-wds-text-ink placeholder:text-wds-neutral-500 focus-visible:border-wds-espresso-700 focus-visible:outline-none focus-visible:shadow-wds-ring"
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
              className={cn(
                'h-12 w-full rounded-[2px] border bg-wds-surface pl-3.5 pr-16 text-[14px] font-normal text-wds-text-ink focus-visible:outline-none focus-visible:shadow-wds-ring',
                wrong ? 'border-[1.5px] border-wds-error-fg' : 'border-wds-border-strong focus-visible:border-wds-espresso-700',
              )}
            />
            <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] font-medium text-[#8A5A16] hover:underline focus-visible:outline-none focus-visible:shadow-wds-ring">
              {show ? 'Hide' : 'Show'}
            </button>
          </span>
        </label>
        {online ? (
          <PrimaryButton type="submit" hint="Enter" busy={busy} disabled={paused || email.trim() === '' || password === ''}>
            {paused ? `Wait ${left}s` : 'Sign in'}
          </PrimaryButton>
        ) : (
          <button type="button" onClick={onRetryOffline} className="flex h-11 w-full items-center justify-center border border-wds-border-strong text-[14px] font-medium text-wds-text-ink hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:shadow-wds-ring">
            Try again
          </button>
        )}
      </form>
      <p className="text-center text-[13px] leading-[18px] text-wds-text-secondary">Forgot your password? Ask your manager or HR for a new one.</p>
    </SigninCard>
  );
}
