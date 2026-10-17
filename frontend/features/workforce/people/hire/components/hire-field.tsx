'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FIELD_CLASS } from '../../../_shared';

/**
 * The hire form's field pieces (Paper Chapter 2): a mono capital label over a 40 px field, then the helper or the error. The kit's
 * `FormField` is the dialog form (13 px sentence labels); the wizard draws its labels as Paper does, so it has its own small set.
 * Each control gets its id, `aria-describedby` and `aria-invalid` from the field, so a screen reader reads the label and the error.
 */
const LABEL = 'font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-neutral-600';
const CONTROL = cn(FIELD_CLASS, 'h-10');

export interface ControlIds {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
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
      {children({ id, describedBy: text ? noteId : undefined, invalid: Boolean(error) })}
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
      aria-describedby={ids.describedBy}
      aria-invalid={ids.invalid || undefined}
      className={cn(CONTROL, mono && 'font-wds-mono text-[15px] placeholder:font-wds-sans placeholder:text-[14px]', className)}
      {...props}
    />
  );
}

/** A field with a unit word before ("KES") or after ("h"), the number in mono. */
export function UnitInput({ ids, before, after, ...props }: { ids: ControlIds; before?: string; after?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative flex items-center">
      {before ? <span aria-hidden className="pointer-events-none absolute left-3 font-wds-mono text-[12px] text-wds-text-secondary">{before}</span> : null}
      <input
        id={ids.id}
        inputMode="decimal"
        aria-describedby={ids.describedBy}
        aria-invalid={ids.invalid || undefined}
        className={cn(CONTROL, 'font-wds-mono text-[15px]', before && 'pl-[46px]', after && 'pr-8')}
        {...props}
      />
      {after ? <span aria-hidden className="pointer-events-none absolute right-3 font-wds-mono text-[15px] text-wds-text-ink">{after}</span> : null}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** A native select with the chevron Paper draws. Native keeps the keyboard, the phone picker and the spoken name for free. */
export function HireSelect({
  ids,
  options,
  placeholder,
  ...props
}: { ids: ControlIds; options: readonly SelectOption[]; placeholder?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select id={ids.id} aria-describedby={ids.describedBy} aria-invalid={ids.invalid || undefined} className={cn(CONTROL, 'appearance-none pr-9')} {...props}>
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-wds-text-secondary">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
