'use client';

import * as React from 'react';

import { useNumberPadField } from '@/components/ui2/number-pad';
import { cn } from '@/lib/cn';

/**
 * The one quantity field (Paper "Training fixes", T3 to T6). Used by every screen that asks for an amount.
 *
 *  - Plus and minus move by `step` (a pack: 1 crate = 12 bottles) and repeat while held. 56 px tall, 56 px keys: easy to hit.
 *  - The unit is always shown beside the number.
 *  - On a finger the box opens the in-app number pad (never the phone keyboard); on a mouse it is an ordinary box. Tapping it
 *    selects the whole number, so the next key replaces it. "Next" on the pad moves to the next field.
 *  - "Same as expected" fills what was ordered, asked for or expected. A blind count passes `blind` and never gets it.
 *  - An error sits right under the box, in words, and the box turns red.
 */
export interface QuantityFieldProps {
  /** The thing counted ("Baby marrow"): the box's accessible name and what the pad says it is typing into. */
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  /** Weight and volume take a decimal point; counts do not. */
  decimal?: boolean;
  /** What plus and minus add (default 1). */
  step?: number;
  /** "Steps of 1 crate = 12 bottles", under the box. */
  stepNote?: string;
  /** What was expected: gives the shortcut. Leave out on a blind count. */
  expected?: string;
  /** The shortcut's words ("Same as ordered", "Same as asked"); default "Same as expected". */
  expectedWord?: string;
  /** A blind count: no expected figure, no shortcut, whatever else is passed. */
  blind?: boolean;
  error?: string | null;
  disabled?: boolean;
  /** A line under the box ("Matches what was expected."). */
  note?: React.ReactNode;
  /** After the last field on the pad, "Done" calls this. */
  onDone?: (value: string) => void;
  maxLength?: number;
  className?: string;
}

const clean = (raw: string, decimal: boolean): string => {
  const kept = raw.replace(decimal ? /[^0-9.]/g : /\D/g, '');
  if (!decimal) return kept;
  const [whole = '', ...rest] = kept.split('.');
  return rest.length > 0 ? `${whole}.${rest.join('')}` : whole;
};

/** The number after a step, without float noise ("0.1 + 0.2"), never below 0. */
export const stepValue = (current: string, step: number, direction: 1 | -1): string => {
  const base = Number.parseFloat(current);
  const next = Math.max(0, (Number.isFinite(base) ? base : 0) + direction * step);
  return String(Number(next.toFixed(3)));
};

/** The ui2 `Input` look, for a `PadNumberInput` standing where an `Input` was: `className={cn(PAD_INPUT_CLASS, 'text-right')}`. */
export const PAD_INPUT_CLASS =
  'flex h-8 w-full rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-3 font-wds-sans text-wds-body-sm text-wds-text-ink transition-colors placeholder:text-wds-text-muted focus-visible:outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-wds-error-fg';

export interface PadNumberInputProps {
  label: string;
  unit?: string;
  value: string;
  onChange: (value: string) => void;
  decimal?: boolean;
  maxLength?: number;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onEnter?: () => void;
  autoFocus?: boolean;
  name?: string;
  /** A code made of digits (account number): keeps a leading 0 and never trims. */
  keepZeros?: boolean;
  /** A press on the box also reaches the row it sits in unless the screen stops it. */
  onClick?: React.MouseEventHandler<HTMLInputElement>;
  /** `data-*` markers a screen looks the box up by (a drawer's first box to focus). */
  dataAttrs?: Record<`data-${string}`, string | undefined>;
  /** Shown but not editable (a value only some roles may change): the pad never opens. */
  readOnly?: boolean;
  /** A screen that selects the box itself on focus (so the mouse-up must not clear the selection). */
  onMouseUp?: React.MouseEventHandler<HTMLInputElement>;
  /** A screen with its own keys (Tab to the next count box on a computer). Runs first; Enter still calls `onEnter`. */
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  /** For a screen that moves focus between boxes itself. */
  inputRef?: (node: HTMLInputElement | null) => void;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * Just the box, for rows too tight for the full `QuantityField` (a delivery count line, a pack line): on a finger it opens the
 * in-app number pad and never the phone keyboard; with a mouse it is an ordinary box. Style it with `className`.
 */
export function PadNumberInput({ label, unit, value, onChange, decimal = true, maxLength = 9, id, placeholder, disabled, className, onFocus, onBlur, onEnter, autoFocus, name, keepZeros, onClick, dataAttrs, readOnly, onMouseUp, onKeyDown, inputRef, ...aria }: PadNumberInputProps) {
  const pad = useNumberPadField({ label, unit, value, onChange, decimal, maxLength, keepZeros });
  const setNode = React.useCallback(
    (node: HTMLInputElement | null): void => {
      pad.ref.current = node;
      inputRef?.(node);
    },
    [inputRef, pad.ref],
  );
  return (
    <input
      id={id}
      name={name}
      ref={setNode}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      onMouseUp={onMouseUp}
      autoComplete="off"
      aria-label={id ? undefined : label}
      readOnly={pad.inApp || readOnly}
      inputMode={pad.inApp ? 'none' : decimal ? 'decimal' : 'numeric'}
      onFocus={(e) => {
        onFocus?.();
        if (readOnly) return;
        if (pad.inApp) pad.open();
        else e.currentTarget.select();
      }}
      onClick={(e) => {
        onClick?.(e);
        if (!readOnly) pad.open();
      }}
      onBlur={onBlur}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === 'Enter' && onEnter) {
          e.preventDefault();
          onEnter();
        }
      }}
      onChange={(e) => onChange(clean(e.target.value, decimal))}
      className={cn(className, pad.inApp && 'caret-transparent')}
      {...dataAttrs}
      {...aria}
    />
  );
}

function StepKey({ sign, label, disabled, onStep }: { sign: '−' | '+'; label: string; disabled?: boolean; onStep: () => void }) {
  const timers = React.useRef<{ wait?: number; repeat?: number }>({});
  const stop = (): void => {
    window.clearTimeout(timers.current.wait);
    window.clearInterval(timers.current.repeat);
  };
  React.useEffect(() => stop, []);
  const start = (): void => {
    onStep();
    stop();
    timers.current.wait = window.setTimeout(() => {
      timers.current.repeat = window.setInterval(onStep, 110);
    }, 420);
  };
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        start();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onStep();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      className="flex h-14 w-14 shrink-0 touch-manipulation select-none items-center justify-center border border-wds-border-strong bg-wds-neutral-50 font-wds-sans text-[26px] leading-none text-wds-text-ink outline-none transition-colors focus-visible:shadow-wds-ring active:bg-wds-neutral-100 disabled:opacity-50"
    >
      {sign}
    </button>
  );
}

export function QuantityField({ label, unit, value, onChange, decimal = false, step = 1, stepNote, expected, expectedWord = 'Same as expected', blind = false, error, disabled, note, onDone, maxLength = 9, className }: QuantityFieldProps) {
  const pad = useNumberPadField({ label, unit, value, onChange, decimal, maxLength, onDone });
  const latest = React.useRef(value);
  latest.current = value;
  const change = (direction: 1 | -1) => (): void => {
    const next = stepValue(latest.current, step, direction);
    latest.current = next;
    onChange(next);
  };
  const showShortcut = !blind && expected !== undefined && expected !== '' && value !== expected;
  const errorId = React.useId();
  const empty = value === '';

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex h-14">
        <StepKey sign="−" label={`One less ${label}`} disabled={disabled || empty || Number.parseFloat(value) <= 0} onStep={change(-1)} />
        <label
          className={cn(
            'flex min-w-0 grow items-center justify-center gap-2 border-y bg-wds-surface px-2 transition-shadow',
            error ? 'border-2 border-wds-error-fg bg-wds-error-bg' : pad.active ? 'border-2 border-[var(--wds-primary-btn-start)] shadow-[0_0_0_3px_var(--wds-caramel-100)]' : 'border-wds-border-strong',
          )}
        >
          <input
            id={pad.id}
            ref={pad.ref as React.RefObject<HTMLInputElement>}
            value={value}
            placeholder="0"
            disabled={disabled}
            autoComplete="off"
            aria-label={`${label}, in ${unit}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            readOnly={pad.inApp}
            inputMode={pad.inApp ? 'none' : decimal ? 'decimal' : 'numeric'}
            onFocus={(e) => {
              if (pad.inApp) pad.open();
              else e.currentTarget.select();
            }}
            onClick={() => pad.open()}
            onChange={(e) => onChange(clean(e.target.value, decimal))}
            className={cn('w-full min-w-0 bg-transparent text-center font-wds-mono text-[24px] leading-8 outline-none placeholder:text-wds-text-faint', error ? 'text-wds-error-fg' : 'text-wds-text-ink', pad.inApp && 'caret-transparent')}
          />
          <span className="shrink-0 font-wds-mono text-[14px] leading-5 text-wds-text-secondary">{unit}</span>
        </label>
        <StepKey sign="+" label={`One more ${label}`} disabled={disabled} onStep={change(1)} />
      </div>
      {stepNote ? <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{stepNote}</p> : null}
      {error ? (
        <p id={errorId} role="alert" className="font-wds-sans text-[13px] font-medium leading-[18px] text-wds-error-fg">
          {error}
        </p>
      ) : note ? (
        <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{note}</p>
      ) : null}
      {showShortcut ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(expected)}
          className="flex h-12 items-center justify-center border border-wds-border-strong bg-wds-surface font-wds-sans text-[15px] font-medium leading-5 text-wds-espresso-700 outline-none transition-colors focus-visible:shadow-wds-ring active:bg-wds-neutral-100 disabled:opacity-50"
        >
          {expectedWord} · {expected} {unit}
        </button>
      ) : null}
    </div>
  );
}
