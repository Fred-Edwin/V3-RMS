'use client';

import * as React from 'react';

import { Picker } from '@/components/ui2/picker';

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
 * A phone list filter drawn the way Paper draws it (steps 53 and 54): a 34 px outlined box, "Status: All ▾". The list is the app's own
 * `Picker`, never the browser's `<select>` (whose list Android draws itself, over the field: training fix 11, 12 Oct 2026).
 */
export function PhoneFilterSelect({ label, allLabel = 'All', options, value, onChange }: PhoneFilterSelectProps) {
  const all = [{ value: '', label: `${label}: ${allLabel}` }, ...options.map((o) => ({ value: o.value, label: `${label}: ${o.label}` }))];
  return (
    <div className="min-w-[150px]">
      <Picker aria-label={label} value={value ?? ''} onValueChange={(v) => onChange(v || undefined)} options={all} chips={false} searchable={false} className="h-[34px] text-[13px]" />
    </div>
  );
}
