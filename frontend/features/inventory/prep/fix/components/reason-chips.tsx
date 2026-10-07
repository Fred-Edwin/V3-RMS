'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

export interface ReasonChipsProps<T extends string> {
  /** The mono caption above the chips, e.g. "Why are you correcting it?". */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | undefined;
  onChange: (next: T) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * The reason chips (Paper steps 14, 16, 18): one is required, so unlike the optional yield chips a second tap on the chosen
 * one does not clear it. `aria-pressed` carries the choice for a screen reader; the chosen chip is also bolder and tinted, so
 * colour is never the only signal. Each chip is at least 44px tall for a thumb.
 */
export function ReasonChips<T extends string>({ label, options, value, onChange, disabled = false, className }: ReasonChipsProps<T>) {
  const labelId = React.useId();
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span id={labelId} className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-copy-muted">
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                'min-h-11 border px-[14px] py-[11px] font-wds-sans text-wds-body outline-none transition-colors focus-visible:shadow-wds-ring disabled:pointer-events-none disabled:opacity-60',
                on ? 'border-wds-espresso-700 bg-wds-espresso-50 font-medium text-wds-espresso-700' : 'border-wds-border-strong bg-wds-surface text-wds-text-ink hover:bg-wds-neutral-50'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
