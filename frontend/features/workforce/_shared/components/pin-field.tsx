'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { PadInputOTP } from '@/components/ui2/input-otp';

import { MOTION } from '../lib/interaction';

/**
 * The two ways Workforce asks for a secret.
 *
 * `PinField` (Paper 1J7K-0, 1DAK-0, 1KGT-0) is ONE wide bordered field that
 * shows a dot per digit. It is for a signed act: the signer's own PIN. The last
 * (fourth) digit calls `onComplete`; Enter never does. On a phone the app's
 * number pad opens instead of the keyboard (`PadInputOTP`).
 *
 * `CodeBoxes` (Paper 1PNG-0) is four separate boxes for the payslip code, with
 * a red border on every box when the code is wrong.
 *
 * Both are controlled. Neither holds a role name or a word of its own except the
 * accessible label the screen passes.
 */

export const PIN_LENGTH = 4;

interface SecretProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name; also what the phone pad says it is typing. */
  label: string;
  /** Called once when the last digit is typed. */
  onComplete?: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

const noEnter = (e: React.KeyboardEvent) => {
  // A signed act is never completed by Enter (rule 09). The last digit signs.
  if (e.key === 'Enter') e.preventDefault();
};

export function PinField({ value, onChange, label, onComplete, invalid = false, disabled = false, autoFocus = false, className }: SecretProps) {
  return (
    <PadInputOTP
      maxLength={PIN_LENGTH}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      onKeyDown={noEnter}
      padLabel={label}
      aria-label={label}
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      disabled={disabled}
      containerClassName={cn('w-full has-[:disabled]:opacity-60', className)}
      render={({ slots }) => {
        const focused = slots.some((s) => s.isActive);
        return (
          <div
            data-invalid={invalid || undefined}
            className={cn(
              'flex h-10 w-full items-center border bg-wds-surface px-3 font-wds-mono text-[18px] leading-[22px] tracking-[0.3em] text-wds-text-ink',
              MOTION,
              invalid ? 'border-wds-error-fg' : 'border-wds-text-ink',
              focused && 'shadow-wds-ring'
            )}
          >
            {slots.map((s, i) => (
              <span key={i} aria-hidden className={s.char ? undefined : 'text-wds-neutral-300'}>
                •
              </span>
            ))}
          </div>
        );
      }}
    />
  );
}

export function CodeBoxes({ value, onChange, label, onComplete, invalid = false, disabled = false, autoFocus = false, className }: SecretProps) {
  return (
    <PadInputOTP
      maxLength={PIN_LENGTH}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      onKeyDown={noEnter}
      padLabel={label}
      aria-label={label}
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      disabled={disabled}
      containerClassName={cn('flex gap-2.5 has-[:disabled]:opacity-60', className)}
      render={({ slots }) => (
        <>
          {slots.map((s, i) => (
            <div
              key={i}
              data-invalid={invalid || undefined}
              className={cn(
                'flex h-[52px] w-11 shrink-0 items-center justify-center border bg-wds-surface font-wds-sans text-[22px] leading-7 text-wds-text-ink',
                MOTION,
                invalid ? 'border-wds-error-fg' : s.isActive ? 'border-[1.5px] border-wds-selected-edge' : 'border-wds-border-strong'
              )}
            >
              {s.char ? <span aria-hidden>•</span> : null}
            </div>
          ))}
        </>
      )}
    />
  );
}
