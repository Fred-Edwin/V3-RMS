'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { usePinPad } from '@/components/ui2/number-pad';
import { cn } from '@/lib/cn';
import { pinProblem } from '../lib/signin-rules';
import { PhoneSupport, PinPad } from './phone-parts';
import { Heading, NoticeBar, PersonStrip, PrimaryButton, SigninCard, StepMarker } from './signin-parts';

/**
 * Step 3, "Set your PIN" (Paper 4.3, 4.4): four digits, chosen and then entered again. Shown only to a person who has no PIN yet.
 * The PIN lives in this component's state and the one request that saves it. On a computer both rows show with a Save button. On a phone
 * (Paper's 390 px frame) one row shows at a time under the number pad: the first four digits move it to the second row, and the PIN
 * saves itself when the second entry matches.
 */

const LENGTH = 4;
const PHONE_QUERY = '(max-width: 1023px)';

/** True while the phone layout is showing (the same 1024 px break the styles use). */
function useIsPhoneLayout(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY);
    const sync = (): void => setPhone(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return phone;
}

interface BoxesProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  boxRef?: React.RefObject<HTMLInputElement>;
  autoFocus?: boolean;
  /** The phone's pad types for the person, so the phone keyboard stays down. */
  padOnScreen: boolean;
  className?: string;
}

function Boxes({ label, value, onChange, disabled, invalid, boxRef, autoFocus, padOnScreen, className }: BoxesProps): JSX.Element {
  // One real input holds the digits (so a keyboard, paste and the password manager all work); the four boxes only draw it.
  const inner = useRef<HTMLInputElement>(null);
  const ref = boxRef ?? inner;
  const [focused, setFocused] = useState(false);
  // On a finger inside the app shell the box opens the in-app number pad; the sign-in page has no pad host, so it stays an ordinary input.
  const pad = usePinPad({ value, onChange, label });
  return (
    <div className={cn('flex-col gap-2.5', className)}>
      <label className={cn('hidden text-[13px] font-medium leading-4 lg:block', disabled ? 'text-wds-neutral-500' : 'text-wds-text-ink')} htmlFor={`pin-${label}`}>
        {label}
      </label>
      <div className="relative flex gap-2.5 lg:gap-3" onClick={() => ref.current?.focus()}>
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
          inputMode={padOnScreen ? 'none' : pad.inputProps.inputMode}
          autoComplete="off"
          maxLength={LENGTH}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-label={label}
          aria-invalid={invalid || undefined}
          className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
        />
        {Array.from({ length: LENGTH }, (_, i) => {
          const current = (focused || padOnScreen) && i === Math.min(value.length, LENGTH - 1) && !disabled;
          return (
            <span
              key={i}
              aria-hidden
              className={cn(
                'flex h-[60px] w-16 items-center justify-center border bg-wds-surface lg:h-16',
                disabled && 'bg-wds-neutral-50',
                invalid ? 'border-wds-error-fg' : current ? 'border-2 border-wds-espresso-700 lg:border-[1.5px]' : 'border-wds-border-strong',
              )}
            >
              {i < value.length ? <span className="size-3 rounded-full bg-wds-text-ink lg:size-2.5" /> : current ? <span className="h-6 w-0.5 animate-pulse bg-wds-espresso-700 motion-reduce:animate-none lg:h-8 lg:w-px lg:bg-wds-text-ink" /> : null}
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
  const isPhone = useIsPhoneLayout();
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const againRef = useRef<HTMLInputElement>(null);
  const savedFor = useRef<string | null>(null);

  const problem = pin.length === LENGTH ? pinProblem(pin) : null;
  const firstDone = pin.length === LENGTH && problem === null;
  const mismatch = again.length === LENGTH && again !== pin;
  const ready = firstDone && again === pin;

  // The second row takes over as soon as the first is four digits.
  useEffect(() => {
    if (firstDone && !isPhone) againRef.current?.focus();
  }, [firstDone, isPhone]);

  // On a phone there is no Save button: the PIN saves when the second entry matches (once per PIN, so a failed save does not loop).
  useEffect(() => {
    if (!isPhone || !ready || busy || savedFor.current === pin) return;
    savedFor.current = pin;
    onSave(pin);
  }, [isPhone, ready, busy, pin, onSave]);

  const secondPass = isPhone && firstDone;
  const active = secondPass ? again : pin;
  const setActive = useCallback((next: string): void => (secondPass ? setAgain(next) : setPin(next)), [secondPass]);
  const message = problem ?? (mismatch ? 'The two PINs are not the same. Enter it again.' : null);
  const lead = isPhone ? (secondPass ? 'Enter it again to be sure.' : 'Four digits, for your payslips and money steps.') : 'Four digits. You use it to open your payslips and to confirm money steps.';

  return (
    <SigninCard
      snug
      top={
        <>
          <StepMarker current="pin" />
          <Heading tight title="Set your PIN" lead={lead} />
          <div className="flex flex-col gap-5">
            <Boxes
              label="Choose a PIN"
              value={pin}
              onChange={setPin}
              disabled={busy}
              invalid={problem !== null}
              autoFocus
              padOnScreen={isPhone}
              className={secondPass ? 'hidden lg:flex' : 'flex'}
            />
            <Boxes
              label="Enter it again"
              value={again}
              onChange={setAgain}
              disabled={busy || !firstDone}
              invalid={mismatch}
              boxRef={againRef}
              padOnScreen={isPhone}
              className={secondPass ? 'flex' : 'hidden lg:flex'}
            />
            <p className={cn('text-[13px] leading-[19px]', message ? 'text-wds-error-fg' : 'hidden text-wds-text-secondary lg:block')}>
              {message ?? 'Not 1234, and not the same digit four times. Nobody else will ever see it.'}
            </p>
          </div>
          {error ? <NoticeBar kind="other">{error}</NoticeBar> : null}
        </>
      }
      middle={<PinPad disabled={busy} onDigit={(d) => setActive((active + d).slice(0, LENGTH))} onDelete={() => setActive(active.slice(0, -1))} />}
      bottom={
        <>
          <div className="hidden lg:block">
            <PrimaryButton busy={busy} disabled={!ready} onClick={() => onSave(pin)}>
              Save PIN
            </PrimaryButton>
          </div>
          <div className="flex flex-col gap-2.5 lg:gap-6">
            <PersonStrip snug name={name} line={line} onNotYou={onNotYou} />
            <PhoneSupport />
          </div>
        </>
      }
    />
  );
}
