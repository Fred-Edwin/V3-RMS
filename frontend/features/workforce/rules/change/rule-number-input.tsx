'use client';

import * as React from 'react';

import { PAD_INPUT_CLASS, PadNumberInput } from '@/components/ui2/quantity-field';
import { cn } from '@/lib/cn';

/**
 * The one box a rule's number is typed in: the app's number box (the in-app pad on a finger, an ordinary box with a mouse), in the
 * dialog's 40 px mono look. Every numeric field on the Rules screens uses it, so the input convention holds in one place.
 */
export function RuleNumberInput({
  label,
  value,
  onChange,
  decimal = false,
  disabled,
  placeholder,
  autoFocus,
  invalid,
  describedBy,
  id,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  decimal?: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  invalid?: boolean;
  describedBy?: string;
  id?: string;
  className?: string;
}) {
  return (
    <PadNumberInput
      label={label}
      id={id}
      value={value}
      onChange={onChange}
      decimal={decimal}
      disabled={disabled}
      placeholder={placeholder}
      autoFocus={autoFocus}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      className={cn(PAD_INPUT_CLASS, 'h-10 font-wds-mono text-[16px]', className)}
    />
  );
}
