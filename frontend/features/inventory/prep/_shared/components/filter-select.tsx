'use client';

import * as React from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui2/select';

const ALL = '__all__';

export interface FilterSelectProps {
  /** Spoken name and the text of the first option's absence: "Output" with "All outputs". */
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
  /** `undefined` is "all". */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  className?: string;
  disabled?: boolean;
}

/** A filter dropdown whose first choice clears the filter (Radix Select cannot hold an empty value, so "all" is a sentinel here). */
export function FilterSelect({ label, allLabel, options, value, onChange, className, disabled }: FilterSelectProps) {
  return (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? undefined : next)} disabled={disabled}>
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
