'use client';

import * as React from 'react';

import { Picker } from '@/components/ui2/picker';
import { PadNumberInput } from '@/components/ui2/quantity-field';
import { cn } from '@/lib/cn';

import { FIELD_CLASS } from '../../../_shared';

/**
 * The hire form's field pieces (Paper Chapter 2): a mono capital label over a 40 px field, then the helper or the error. The kit's
 * `FormField` is the dialog form (13 px sentence labels); the wizard draws its labels as Paper does, so it has its own small set.
 * Each control gets its id, `aria-describedby` and `aria-invalid` from the field, so a screen reader reads the label and the error.
 * Choices use the app's `Picker`, and numbers use the in-app number pad (`PadNumberInput`), never the phone's own list or keyboard
 * (docs/UI_BUILD_RULES.md "Inputs").
 */
const LABEL = 'font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-neutral-600';
const CONTROL = cn(FIELD_CLASS, 'h-10');

export interface ControlIds {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  /** The label's words, for controls that need an accessible name of their own. */
  label: string;
}

export function HireField({
  label,
  note,
  helper,
  error,
  className,
  children,
}: {
  label: string;
  /** Lower-case words after the label, in the mono voice ("needed for their login"). */
  note?: string;
  helper?: string;
  error?: string;
  className?: string;
  children: (ids: ControlIds) => React.ReactNode;
}) {
  const id = React.useId();
  const noteId = `${id}-note`;
  const text = error ?? helper;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className={LABEL}>
        {label}
        {note ? <span className="normal-case"> · {note}</span> : null}
      </label>
      {children({ id, describedBy: text ? noteId : undefined, invalid: Boolean(error), label })}
      {text ? (
        <p id={noteId} role={error ? 'alert' : undefined} className={cn('m-0 font-wds-sans text-[12px] leading-4', error ? 'text-wds-error-fg' : 'text-wds-text-secondary')}>
          {text}
        </p>
      ) : null}
    </div>
  );
}

export function HireInput({ ids, mono = false, className, ...props }: { ids: ControlIds; mono?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      id={ids.id}
      autoComplete="off"
      aria-describedby={ids.describedBy}
      aria-invalid={ids.invalid || undefined}
      className={cn(CONTROL, mono && 'font-wds-mono text-[15px] placeholder:font-wds-sans placeholder:text-[14px]', className)}
      {...props}
    />
  );
}

/** A number box on the in-app pad. `before` ("KES") or `after` ("h") is a unit word drawn inside the field. `code` keeps leading zeros (an ID or account number). */
export function NumberField({
  ids,
  value,
  onChange,
  before,
  after,
  decimal = true,
  code = false,
  maxLength = 12,
  placeholder,
  autoFocus,
}: {
  ids: ControlIds;
  value: string;
  onChange: (value: string) => void;
  before?: string;
  after?: string;
  decimal?: boolean;
  code?: boolean;
  maxLength?: number;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative flex items-center">
      {before ? <span aria-hidden className="pointer-events-none absolute left-3 z-10 font-wds-mono text-[12px] text-wds-text-secondary">{before}</span> : null}
      <PadNumberInput
        label={ids.label}
        id={ids.id}
        value={value}
        onChange={onChange}
        decimal={decimal}
        keepZeros={code}
        maxLength={maxLength}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-invalid={ids.invalid || undefined}
        aria-describedby={ids.describedBy}
        className={cn(CONTROL, 'font-wds-mono text-[15px]', before && 'pl-[46px]', after && 'pr-8')}
      />
      {after ? <span aria-hidden className="pointer-events-none absolute right-3 font-wds-mono text-[15px] text-wds-text-ink">{after}</span> : null}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Draws the row as the person label (frame 7.5); `label` stays what the search matches. */
  render?: (context: { query: string; inField: boolean }) => React.ReactNode;
}

/** The app's picker, drawn as the hire form's field. Few choices show as chips; more open a list (with a search box past six). */
export function HireSelect({
  ids,
  options,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  ids: ControlIds;
  options: readonly SelectOption[];
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Picker
      id={ids.id}
      aria-label={ids.label}
      value={value}
      onValueChange={onChange}
      options={options.filter((o) => !o.disabled)}
      placeholder={placeholder}
      disabled={disabled}
      chips={false}
      className={cn(CONTROL, 'text-left')}
    />
  );
}
