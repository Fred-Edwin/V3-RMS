import * as React from 'react';

import { Picker } from '@/components/ui2/picker';

import { STATE_TAG } from '../../_shared/lib/month-view';
import type { MonthList } from '../../_shared/types/month-types';

/** Narrow desktop (below 1100 px): the months list becomes a select above the month, with the state in each option. */
export function MonthPicker({ data, selected, onSelect }: { data: MonthList | null; selected: string | null; onSelect: (monthKey: string) => void }) {
  if (!data || data.items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 border-b border-wds-neutral-100 pb-3 min-[1100px]:hidden">
      <label htmlFor="payroll-month" className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.08em] text-wds-text-secondary">
        Month
      </label>
      <Picker id="payroll-month" aria-label="Month" chips={false} value={selected ?? ''} onValueChange={onSelect} options={data.items.map((row) => ({ value: row.monthKey, label: `${row.label} · ${STATE_TAG[row.state].label}` }))} />
    </div>
  );
}
