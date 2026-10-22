'use client';

import { useEffect, useRef, useState } from 'react';

import { usePinPad } from '@/components/ui2/number-pad';
import { cn } from '@/lib/cn';
import { pinProblem } from '../lib/signin-rules';
import { Heading, NoticeBar, PersonStrip, PrimaryButton, SigninCard, StepMarker } from './signin-parts';

/**
 * Step 3, "Set your PIN" (Paper 4.3, 4.4): four digits, chosen and then entered again. Shown only to a person who has no PIN yet.
 * The PIN lives in this component's state and the one request that saves it.
 */

const LENGTH = 4;

function Boxes({ label, value, onChange, disabled, invalid, boxRef, autoFocus }: { label: string; value: string; onChange: (next: string) => void; disabled?: boolean; invalid?: boolean; boxRef?: React.RefObject<HTMLInputElement>; autoFocus?: boolean }): JSX.Element {
  // One real input holds the digits (so a phone keypad, paste and the password manager all work); the four boxes only draw it.
  const inner = useRef<HTMLInputElement>(null);
  const ref = boxRef ?? inner;
  const [focused, setFocused] = useState(false);
  // On a finger inside the app shell the box opens the in-app number pad; the sign-in page has no pad host, so it stays an ordinary input.
  const pad = usePinPad({ value, onChange, label });
  return (
    <div className="flex flex-col gap-2.5">
      <label className={cn('text-[13px] font-medium leading-4', disabled ? 'text-wds-neutral-500' : 'text-wds-text-ink')} htmlFor={`pin-${label}`}>
        {label}
      </label>
      <div className="relative flex gap-2.5 sm:gap-3" onClick={() => ref.current?.focus()}>
        <input
          id={`pin-${label}`}
          ref={(node) => {
            (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
            pad.ref.current = node;
          }}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, LENGTH))}
          onFocus={() => {
            setFocused(true);
            pad.inputProps.onFocus();
          }}
          onBlur={() => setFocused(false)}
          inputMode={pad.inputProps.inputMode}
          autoComplete="off"
          maxLength={LENGTH}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={invalid || undefined}
          className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
        />
        {Array.from({ length: LENGTH }, (_, i) => {
          const current = focused && i === Math.min(value.length, LENGTH - 1);
          return (
            <span
              key={i}
              aria-hidden
              className={cn(
                'flex h-16 w-16 items-center justify-center border bg-wds-surface sm:h-16 sm:w-16',
                disabled && 'bg-wds-neutral-50',
                invalid ? 'border-wds-error-fg' : current ? 'border-[1.5px] border-wds-espresso-700' : 'border-wds-border-strong',
              )}
            >
              {i < value.length ? <span className="size-2.5 rounded-full bg-wds-text-ink" /> : current ? <span className="h-8 w-px animate-pulse bg-wds-text-ink motion-reduce:animate-none" /> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export interface PinStepProps {
  name: string;
  line: string;
  busy: boolean;
  /** An error from saving (a refusal from the server). */
  error: string | null;
  onSave: (pin: string) => void;
  onNotYou: () => void;
}

export function PinStep({ name, line, busy, error, onSave, onNotYou }: PinStepProps): JSX.Element {
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const againRef = useRef<HTMLInputElement>(null);

  // The second row takes over as soon as the first is four digits.
  useEffect(() => {
    if (pin.length === LENGTH && pinProblem(pin) === null) againRef.current?.focus();
  }, [pin]);

  const problem = pin.length === LENGTH ? pinProblem(pin) : null;
  const mismatch = again.length === LENGTH && again !== pin;
  const ready = pin.length === LENGTH && problem === null && again === pin;

  return (
    <SigninCard>
      <StepMarker current="pin" />
      <Heading title="Set your PIN" lead="Four digits. You use it to open your payslips and to confirm money steps." />
      <div className="flex flex-col gap-5">
        <Boxes label="Choose a PIN" value={pin} onChange={setPin} disabled={busy} invalid={problem !== null} autoFocus />
        <Boxes label="Enter it again" value={again} onChange={setAgain} disabled={busy || pin.length < LENGTH || problem !== null} invalid={mismatch} boxRef={againRef} />
        <p className={cn('text-[13px] leading-[19px]', problem || mismatch ? 'text-wds-error-fg' : 'text-wds-text-secondary')}>
          {problem ?? (mismatch ? 'The two PINs are not the same. Enter it again.' : 'Not 1234, and not the same digit four times. Nobody else will ever see it.')}
        </p>
      </div>
      {error ? <NoticeBar kind="other">{error}</NoticeBar> : null}
      <PrimaryButton busy={busy} disabled={!ready} onClick={() => onSave(pin)}>
        Save PIN
      </PrimaryButton>
      <PersonStrip name={name} line={line} onNotYou={onNotYou} />
    </SigninCard>
  );
}
