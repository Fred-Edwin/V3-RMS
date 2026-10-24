'use client';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION } from '../../../_shared';
import { weekdayNumber } from '../../_shared/lib/month-words';
import { dayTitle } from '../../_shared/lib/timesheet-words';
import type { GlanceKind } from '../../_shared/types/month-types';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

const SWATCH: Record<GlanceKind, string> = {
  WORKED: 'border border-wds-border-strong bg-wds-surface text-wds-text-ink',
  LATE: 'border border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg',
  OVERTIME_TO_DECIDE: 'border border-wds-caramel-600 bg-wds-caramel-600 font-semibold text-white',
  NEEDS_LOOK: 'border border-wds-warning-border bg-wds-caramel-100 text-wds-warning-fg',
  ABSENT: 'border border-wds-error-border bg-wds-error-bg text-wds-error-fg',
  REST: 'border border-transparent bg-wds-neutral-100 text-wds-neutral-500',
};

const WORDS: Record<GlanceKind, string> = { WORKED: 'worked, as planned', LATE: 'late', OVERTIME_TO_DECIDE: 'overtime to decide', NEEDS_LOOK: 'needs a look', ABSENT: 'absent', REST: 'rest day' };

export const GLANCE_LEGEND: { kind: GlanceKind; label: string }[] = [
  { kind: 'WORKED', label: 'Worked, matches the shift' },
  { kind: 'LATE', label: 'Late' },
  { kind: 'OVERTIME_TO_DECIDE', label: 'Overtime to decide' },
  { kind: 'REST', label: 'Rest day' },
];

/** The key under the calendar: a small swatch in each day colour with its words. */
export function GlanceLegend() {
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0 font-wds-sans text-[13px] leading-4 text-wds-text-ink">
      {GLANCE_LEGEND.map((l) => (
        <li key={l.kind} className="flex items-center gap-2">
          <span aria-hidden className={cn('inline-block size-3.5 shrink-0', SWATCH[l.kind])} />
          {l.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * The month at a glance (spec S5): a calendar built from the days given, so a 31-day month and February come out right. Each day is a
 * button named "Wed 9 Sep, worked, on the rota"; choosing it takes the table to that day. Colour is never the only signal: the
 * accessible name says it too.
 */
export function CalendarGlance({ days, onPick }: { days: readonly { date: string; kind: GlanceKind }[]; onPick: (date: string) => void }) {
  if (days.length === 0) return null;
  const lead = weekdayNumber(days[0]!.date) - 1;
  const cells: ({ date: string; kind: GlanceKind } | null)[] = [...Array.from({ length: lead }, () => null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  return (
    <table className="w-fit border-separate border-spacing-[3px]">
      <caption className="sr-only">The month at a glance</caption>
      <thead>
        <tr>
          {WEEKDAYS.map((w) => (
            <th key={w} scope="col" className="w-9 pb-1 text-center font-wds-mono text-[10px] font-normal leading-3 text-wds-text-secondary">
              {w}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, i) => (
          <tr key={i}>
            {week.map((cell, j) =>
              cell ? (
                <td key={cell.date} className="p-0">
                  <button type="button" aria-label={`${dayTitle(cell.date)}, ${WORDS[cell.kind]}`} onClick={() => onPick(cell.date)} className={cn('h-[34px] w-9 text-center font-wds-sans text-[12px] leading-4', SWATCH[cell.kind], MOTION, FOCUS_RING)}>
                    {Number(cell.date.slice(8, 10))}
                  </button>
                </td>
              ) : (
                <td key={`blank-${i}-${j}`} aria-hidden />
              )
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
