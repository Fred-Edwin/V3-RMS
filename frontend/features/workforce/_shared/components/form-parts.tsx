'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { maskClock, parseClock } from '../lib/time';

/**
 * Form pieces (Paper 18X4-0 "Add a shift", 1AMN-0).
 *
 * - `FormField` is a label (13 px, 500), the control, then a helper line or an error. It gives
 *   the control an id and `aria-describedby`; the control can be any of the kit's inputs.
 * - `FIELD_CLASS` is the field look: 36 px high, 1 px strong border, espresso border and a soft
 *   ring on focus, red border when invalid. Put it on an `<input>` or `<textarea>`.
 * - `TimeField` is a mono `hh:mm` box. It masks while typing and fills in the minutes when you
 *   leave it ("430" becomes "04:30"); a time that is not real shows an error.
 */

export const FIELD_CLASS = cn(
  'h-9 w-full border border-wds-border-strong bg-wds-surface px-3 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink',
  'placeholder:text-wds-text-faint',
  'transition-[border-color,box-shadow] duration-150',
  'focus-visible:border-wds-primary focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--wds-primary)_12%,transparent)]',
  'disabled:cursor-not-allowed disabled:opacity-60',
  'aria-[invalid=true]:border-wds-error-fg'
);

export interface FieldIds {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

export function FormField({
  label,
  hint,
  helper,
  error,
  children,
  className,
}: {
  label: string;
  /** "optional" or "required" after the label. */
  hint?: 'optional' | 'required';
  helper?: string;
  /** Replaces the helper and turns the field red. */
  error?: string;
  /** Receives what the control needs: its id, `aria-describedby` and whether it is invalid. */
  children: (ids: FieldIds) => React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  const noteId = `${id}-note`;
  const note = error ?? helper;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="flex items-baseline gap-2 font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">
        {label}
        {hint ? <span className="font-wds-sans text-[12px] font-normal leading-4 text-wds-text-secondary">{hint}</span> : null}
      </label>
      {children({ id, describedBy: note ? noteId : undefined, invalid: Boolean(error) })}
      {note ? (
        <p id={noteId} role={error ? 'alert' : undefined} className={cn('m-0 font-wds-sans text-[12px] leading-4', error ? 'text-wds-error-fg' : 'text-wds-text-secondary')}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

export function TimeField({
  label,
  value,
  onChange,
  helper,
  error,
  disabled = false,
  hint,
  className,
}: {
  label: string;
  /** "04:00", or the half-typed text. */
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  /** An error from the screen (such as "Ends must be later"). A time that is not real adds its own. */
  error?: string;
  disabled?: boolean;
  hint?: 'optional' | 'required';
  className?: string;
}) {
  const [touched, setTouched] = React.useState(false);
  const notReal = touched && value !== '' && parseClock(value) === null;
  const shownError = error ?? (notReal ? 'Use a time like 14:30.' : undefined);
  return (
    <FormField label={label} hint={hint} helper={helper} error={shownError} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="hh:mm"
          maxLength={5}
          value={value}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(maskClock(e.target.value))}
          onBlur={() => {
            setTouched(true);
            const full = parseClock(value);
            if (full && full !== value) onChange(full);
          }}
          className={cn(FIELD_CLASS, 'font-wds-mono text-[13px] leading-4')}
        />
      )}
    </FormField>
  );
}
