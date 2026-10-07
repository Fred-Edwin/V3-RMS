'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { bumpAmount } from '../lib/recipe-form';
import { PRESS } from '../lib/press';

export interface AmountStepperProps {
  value: string;
  unit: string;
  onChange: (next: string) => void;
  /** Accessible name, e.g. "Chicken, cut amount". */
  label: string;
  invalid?: boolean;
}

/** The ingredient amount control of Paper step 25: a bordered - [number unit] + (32 / 72 / 32 px wide, 36 px tall). Tap the number to type. */
export function AmountStepper({ value, unit, onChange, label, invalid = false }: AmountStepperProps) {
  const btn = cn('flex h-9 w-8 shrink-0 items-center justify-center font-wds-sans text-[16px] leading-5 text-wds-text-ink', PRESS);
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex shrink-0 items-center border bg-white', invalid ? 'border-wds-error-fg' : 'border-wds-border-strong')}
    >
      <button type="button" aria-label={`Less ${label}`} onClick={() => onChange(bumpAmount(value, -1, unit))} className={cn(btn, 'border-r border-wds-border-strong')}>
        −
      </button>
      <label className="flex h-9 min-w-[72px] shrink-0 items-center justify-center gap-1 px-1.5">
        <input
          inputMode="decimal"
          autoComplete="off"
          aria-label={label}
          value={value}
          onChange={(e) => {
            const next = e.target.value.replace(',', '.');
            if (/^\d*\.?\d{0,4}$/.test(next)) onChange(next);
          }}
          className="w-10 min-w-0 bg-transparent text-right font-wds-mono text-[14px] leading-[18px] font-medium text-wds-text-ink outline-none"
        />
        <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">{unit}</span>
      </label>
      <button type="button" aria-label={`More ${label}`} onClick={() => onChange(bumpAmount(value, 1, unit))} className={cn(btn, 'border-l border-wds-border-strong')}>
        +
      </button>
    </div>
  );
}
