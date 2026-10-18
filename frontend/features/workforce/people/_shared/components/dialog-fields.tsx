'use client';

import * as React from 'react';

import { Picker } from '@/components/ui2/picker';
import { PadNumberInput } from '@/components/ui2/quantity-field';
import { cn } from '@/lib/cn';

import { Callout, FIELD_CLASS, FormField } from '../../../_shared';

/**
 * The dialog form's fields (Paper Chapter 4 dialogs): a 13 px label over a 36 px field. Choices use the app's `Picker`, numbers the
 * in-app pad, dates the kit's `SingleDateField`, never the phone's own list or keyboard (docs/UI_BUILD_RULES.md "Inputs").
 */
export interface Choice {
  value: string;
  label: string;
}

export function DialogPicker({
  label,
  value,
  onChange,
  options,
  placeholder = 'Choose',
  hint,
  helper,
  error,
  disabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly Choice[];
  placeholder?: string;
  hint?: 'optional' | 'required';
  helper?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <FormField label={label} hint={hint} helper={helper} error={error} className={className}>
      {({ id }) => (
        <Picker id={id} aria-label={label} value={value} onValueChange={onChange} options={options} placeholder={placeholder} disabled={disabled} chips={false} className={cn(FIELD_CLASS, 'text-left')} />
      )}
    </FormField>
  );
}

/** A number on the in-app pad with a unit word inside the field ("KES", "months"). `code` keeps leading zeros. */
export function DialogNumber({
  label,
  value,
  onChange,
  before,
  after,
  decimal = false,
  maxLength = 9,
  hint,
  helper,
  error,
  autoFocus,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  before?: string;
  after?: string;
  decimal?: boolean;
  maxLength?: number;
  hint?: 'optional' | 'required';
  helper?: string;
  error?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <FormField label={label} hint={hint} helper={helper} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="relative flex items-center">
          {before ? <span aria-hidden className="pointer-events-none absolute left-3 z-10 font-wds-mono text-[13px] leading-4 text-wds-text-secondary">{before}</span> : null}
          <PadNumberInput
            label={label}
            id={id}
            value={value}
            onChange={onChange}
            decimal={decimal}
            maxLength={maxLength}
            autoFocus={autoFocus}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(FIELD_CLASS, 'font-wds-mono text-[14px]', before && 'pl-11', after && 'pr-20')}
          />
          {after ? <span aria-hidden className="pointer-events-none absolute right-3 font-wds-mono text-[13px] leading-4 text-wds-text-secondary">{after}</span> : null}
        </div>
      )}
    </FormField>
  );
}

export function DialogText({
  label,
  value,
  onChange,
  type = 'text',
  mono = false,
  hint,
  helper,
  error,
  autoFocus,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'tel';
  mono?: boolean;
  hint?: 'optional' | 'required';
  helper?: string;
  error?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <FormField label={label} hint={hint} helper={helper} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          type={type}
          value={value}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn(FIELD_CLASS, mono && 'font-wds-mono text-[13px]')}
        />
      )}
    </FormField>
  );
}

export function DialogTextArea({
  label,
  value,
  onChange,
  hint,
  helper,
  error,
  rows = 3,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: 'optional' | 'required';
  helper?: string;
  error?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <FormField label={label} hint={hint} helper={helper} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} rows={rows} value={value} autoComplete="off" aria-describedby={describedBy} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value)} className={cn(FIELD_CLASS, 'h-auto py-2 leading-5')} />
      )}
    </FormField>
  );
}

/** A field the dialog shows but does not let you change (Paper's grey "Now" and "Clocks in and out" boxes). */
export function ReadOnlyField({ label, value, mono = false, className }: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <FormField label={label} className={className}>
      {({ id }) => (
        <div id={id} className={cn('flex h-9 items-center border border-wds-border bg-wds-neutral-50 px-3 text-[14px] leading-[18px] text-wds-text-secondary', mono ? 'font-wds-mono' : 'font-wds-sans')}>
          {value}
        </div>
      )}
    </FormField>
  );
}

/** The grey words at the left of a dialog footer ("Logged, with your name."). */
export function FooterNote({ children }: { children: React.ReactNode }) {
  return <span className="mr-auto min-w-0 flex-1 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{children}</span>;
}

/** The server's refusal, in its own words, inside the dialog. */
export function DialogError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Callout tone="error" role="alert" size="sm">
      {message}
    </Callout>
  );
}
