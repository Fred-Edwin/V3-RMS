'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { formatQuantity, parseTypedQuantity, stepQuantity } from '../lib/prep-format';

/**
 * PrepStepper: "− number unit +" (Paper `1UL4-0`, rule table `1UXT-0`). Steps by 0.5 for kg and litres and by 1 for portions
 * (`stepForUnit`), and a tap on the number types it in. The value is a decimal string; this component never puts a float on the
 * wire. 44px tap targets, hairline dividers, and the espresso border while the field has focus (Paper draws it on the row in use).
 *
 * `wide` makes the number cell 92px for the output row ("72 portions"); the used rows are 68px.
 */
export interface PrepStepperProps {
  value: string;
  unit: string;
  onChange: (next: string) => void;
  /** Accessible name, e.g. "Chicken, cut". */
  label: string;
  wide?: boolean;
  /** `sans` is Paper's Fix a slip stepper (step 14: Geist 600 number, 12px unit); `mono` is the record form's (step 39). */
  numeral?: 'mono' | 'sans';
  disabled?: boolean;
  className?: string;
}

const buttonClass =
  'flex size-11 shrink-0 select-none items-center justify-center font-wds-sans text-[18px] leading-[22px] text-black outline-none transition-colors hover:bg-wds-neutral-50 active:bg-wds-neutral-100 focus-visible:bg-wds-neutral-50 disabled:pointer-events-none disabled:opacity-60';

export function PrepStepper({ value, unit, onChange, label, wide = false, numeral = 'mono', disabled = false, className }: PrepStepperProps) {
  const sans = numeral === 'sans';
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? formatQuantity(value);

  const commit = (): void => {
    if (draft !== null) {
      const parsed = parseTypedQuantity(draft);
      if (parsed !== null) onChange(parsed);
    }
    setDraft(null);
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex items-center border border-wds-neutral-300 bg-wds-surface transition-colors focus-within:border-wds-espresso-700', className)}
    >
      <button
        type="button"
        aria-label={`Less ${label}`}
        disabled={disabled}
        onClick={() => onChange(stepQuantity(value, -1, unit))}
        className={cn(buttonClass, 'border-r border-wds-neutral-300')}
      >
        −
      </button>
      <label className={cn('flex h-11 shrink-0 cursor-text items-center justify-center gap-[3px]', 'px-1', wide ? 'min-w-[92px]' : 'min-w-[68px]')}>
        <input
          inputMode="decimal"
          aria-label={`${label} amount`}
          disabled={disabled}
          value={shown}
          onFocus={(e) => {
            setDraft(formatQuantity(value));
            e.currentTarget.select();
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
          style={{ width: `${Math.max(shown.length, 1) + 0.4}ch` }}
          className={cn('min-w-0 border-0 bg-transparent p-0 text-center text-wds-text-ink outline-none', sans ? 'font-wds-sans text-[18px] font-semibold leading-[22px]' : 'font-wds-mono text-[18px] leading-[22px]')}
        />
        <span className={cn('font-wds-mono text-wds-text-copy-muted', sans ? 'text-[12px] leading-4' : 'text-[11px] leading-[14px]')}>{unit}</span>
      </label>
      <button
        type="button"
        aria-label={`More ${label}`}
        disabled={disabled}
        onClick={() => onChange(stepQuantity(value, 1, unit))}
        className={cn(buttonClass, 'border-l border-wds-neutral-300')}
      >
        +
      </button>
    </div>
  );
}
