'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

export interface PhoneFilterSelectProps {
  /** "Status": read out for the control and drawn in front of the choice ("Status: All"). */
  label: string;
  /** The choice that means no filter, drawn as "All". */
  allLabel?: string;
  options: readonly { value: string; label: string }[];
  /** The chosen option's value, or `undefined` for "all". */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

/**
 * A phone list filter drawn the way Paper draws it (steps 53 and 54): a 34 px outlined box that is as wide as its own text, "Status:
 * All ▾". A real `<select>` sits invisibly on top, so the keyboard, the screen reader and the phone's own picker all work, and the
 * tap area is stretched to 44 px.
 */
export function PhoneFilterSelect({ label, allLabel = 'All', options, value, onChange }: PhoneFilterSelectProps) {
  const current = options.find((o) => o.value === value)?.label ?? allLabel;
  return (
    <label className={cn('relative flex h-[34px] items-center gap-2 border border-wds-border-strong bg-wds-surface px-3 font-wds-sans text-[13px] leading-4 text-wds-text-ink transition-colors focus-within:shadow-wds-ring hover:bg-wds-neutral-50')}>
      <span aria-hidden="true">
        {label}: {current}
      </span>
      <span aria-hidden="true" className="text-[9px]">▾</span>
      <select
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="absolute inset-x-0 -inset-y-[5px] h-11 w-full cursor-pointer opacity-0"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
