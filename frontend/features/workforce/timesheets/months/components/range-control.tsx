'use client';

import * as React from 'react';

import { DateRangePicker } from '@/components/ui2/date-range-picker';
import { Picker } from '@/components/ui2/picker';

import { FOCUS_RING, MOTION } from '../../../_shared';
import { cn } from '@/lib/cn';
import { rangeLabel, spanCaption, weekPicks } from '../../_shared/lib/month-words';

/**
 * The date range of the month page (spec S2): the approved range picker limited to the days of the month (for the open month, to
 * today), a Picker of the month's weeks as quick picks, and a quiet "Whole month" to come back. `value` null is the whole month.
 */
export function RangeControl({
  first,
  last,
  today,
  value,
  onChange,
}: {
  first: string;
  last: string;
  today: string;
  value: { from: string; to: string } | null;
  onChange: (range: { from: string; to: string } | null) => void;
}) {
  const weeks = React.useMemo(() => weekPicks(first, last), [first, last]);
  const shown = value ?? { from: first, to: last };
  const matching = weeks.find((w) => w.from === shown.from && w.to === shown.to);
  const options = [{ value: 'month', label: 'Whole month' }, ...weeks.map((w) => ({ value: w.key, label: w.label })), ...(value && !matching ? [{ value: 'custom', label: rangeLabel(shown.from, shown.to) }] : [])];
  const chosen = !value ? 'month' : (matching?.key ?? 'custom');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Picker
        aria-label="Quick pick a week"
        value={chosen}
        options={options}
        chips={false}
        searchable={false}
        className="h-[38px] w-[200px]"
        onValueChange={(v) => {
          if (v === 'month') onChange(null);
          else {
            const week = weeks.find((w) => w.key === v);
            if (week) onChange({ from: week.from, to: week.to });
          }
        }}
      />
      <DateRangePicker
        label="Days"
        showLabel={false}
        today={today}
        value={shown}
        minDate={first}
        maxDate={last}
        note={`Only days inside the month can be picked here. Weeks run Monday to Sunday. ${spanCaption(shown.from, shown.to)}.`}
        buttonClassName="border-wds-text-ink font-medium"
        onChange={(r) => {
          if (!r) return onChange(null);
          onChange(r.from === first && r.to === last ? null : r);
        }}
      />
      {value ? (
        <button type="button" onClick={() => onChange(null)} className={cn('font-wds-sans text-[13px] leading-4 text-wds-text-secondary underline underline-offset-2', MOTION, FOCUS_RING)}>
          Whole month
        </button>
      ) : null}
    </div>
  );
}
