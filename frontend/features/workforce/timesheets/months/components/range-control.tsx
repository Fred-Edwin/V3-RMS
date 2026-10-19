'use client';

import { DateRangePicker } from '@/components/ui2/date-range-picker';
import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION } from '../../../_shared';
import { spanCaption } from '../../_shared/lib/month-words';

/**
 * The one date control of the month page (spec S2): the approved range picker limited to the days of the month (for the open month, to
 * today), and a quiet "Whole month" to come back. `value` null is the whole month.
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
  const shown = value ?? { from: first, to: last };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DateRangePicker
        label="Days"
        showLabel={false}
        today={today}
        value={shown}
        minDate={first}
        maxDate={last}
        note={`Only days inside the month can be picked here. Weeks run Monday to Sunday. ${spanCaption(shown.from, shown.to)}.`}
        buttonClassName={cn('h-8 px-3 text-[12px] max-sm:h-11', value && 'border-wds-text-ink font-medium')}
        onChange={(r) => {
          if (!r) return onChange(null);
          onChange(r.from === first && r.to === last ? null : r);
        }}
      />
      {value ? (
        <button type="button" onClick={() => onChange(null)} className={cn('font-wds-sans text-[12px] leading-4 text-wds-text-secondary underline underline-offset-2', MOTION, FOCUS_RING)}>
          Whole month
        </button>
      ) : null}
    </div>
  );
}
