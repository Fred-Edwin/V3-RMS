'use client';

import * as React from 'react';

import { DateRangePicker } from '@/components/ui2/date-range-picker';
import { nairobiToday } from '@/components/ui2/data-table/table-dates';
import { cn } from '@/lib/cn';

/**
 * Single-day date field (Interaction spec rule 13): a field with the calendar
 * icon that opens the approved picker for one day. Dates are never typed into a
 * plain box. A start date can be in the future (`maxDate`); a "last day" cannot
 * (the default stops at today, in Nairobi time).
 *
 * The value is a `YYYY-MM-DD` day string, the same as the API sends.
 */
export function SingleDateField({
  label,
  value,
  onChange,
  maxDate,
  minDate,
  helper,
  error,
  className,
}: {
  /** Small caps label over the field, e.g. "STARTS ON". */
  label: string;
  value: string | null;
  onChange: (day: string) => void;
  maxDate?: string;
  minDate?: string;
  helper?: string;
  error?: string;
  className?: string;
}) {
  const today = nairobiToday();
  const note = maxDate && maxDate > today ? 'Pick the day it starts.' : minDate ? 'Earlier days can’t be picked.' : 'Later dates can’t be picked.';
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">{label}</span>
      <DateRangePicker
        single
        label={label}
        today={today}
        maxDate={maxDate}
        minDate={minDate}
        note={note}
        value={value ? { from: value, to: value } : null}
        onChange={(r) => {
          if (r) onChange(r.from);
        }}
        buttonClassName={cn('h-10 w-full justify-start', error && 'border-wds-error-fg')}
        className="w-full"
      />
      {error ? (
        <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">
          {error}
        </span>
      ) : helper ? (
        <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{helper}</span>
      ) : null}
    </div>
  );
}
