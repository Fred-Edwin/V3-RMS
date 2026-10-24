'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, PRESSED, onHover } from '../../lib/style/interaction';
import { nextInGroup } from '../../lib/data/roving';
import { SHIFT_PAINT, type ShiftTone } from '../../lib/style/shift-palette';

/**
 * The phone pieces that show days and weeks: `WeekBars` ("This week", Paper 19VJ-0), `DayStrip` (MON 12 ... SUN 18, 199L-0),
 * `DayCard` (one day of the rota, 1CGR-0) and `TimeRow` (one day of last week's hours, 1CHU-0). Presentational; `phone-parts.tsx`
 * re-exports them so the kit keeps one import.
 */

export interface WeekBar {
  /** One letter: M T W T F S S. */
  letter: string;
  /** 0 to 1 of the 40 px bar; 0 draws the 2 px line of a day off. */
  fraction: number;
  state: 'planned' | 'worked' | 'off';
  today?: boolean;
  /** Overtime on this day, as a fraction of the 40 px bar, stacked in caramel above the worked bar (Paper QIB-0). */
  extra?: number;
  /** Spoken: "Monday, 8 hours planned". */
  label: string;
}

export function WeekBars({
  title,
  range,
  bars,
  caption,
  footer,
}: {
  title: string;
  range: string;
  bars: readonly WeekBar[];
  caption?: string;
  /** In place of `caption`: the ruled footer under the bars, with the week's hours and any overtime waiting (Paper QIM-0). */
  footer?: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3.5 border border-wds-border bg-wds-surface px-5 py-[18px] shadow-[0_10px_24px_-18px_color-mix(in_oklab,var(--wds-neutral-950)_18%,transparent)]">
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-text-ink">{title}</h2>
        <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">{range}</span>
      </div>
      <ul className="m-0 flex h-[60px] list-none items-end justify-between p-0">
        {bars.map((b, i) => (
          <li key={i} className="flex flex-col items-center gap-1.5" aria-label={b.label}>
            <span aria-hidden className="flex w-[22px] flex-col">
              {b.extra && b.extra > 0 ? <span className="w-[22px] shrink-0 bg-wds-caramel-500" style={{ height: Math.round(40 * Math.min(1, b.extra)) }} /> : null}
              <span
                className={cn(
                  'w-[22px] shrink-0',
                  b.state === 'off' || b.fraction <= 0 ? 'bg-wds-border-strong' : b.state === 'worked' ? 'bg-wds-success-fg' : 'bg-wds-border-strong',
                  // Paper QIJ-0: today's bar wears a 2 px canvas gap and a 3 px edge ring.
                  b.today && 'shadow-[0_0_0_2px_var(--wds-canvas),0_0_0_3px_var(--wds-selected-edge)]'
                )}
                style={{ height: b.state === 'off' || b.fraction <= 0 ? 2 : Math.round(40 * Math.min(1, b.fraction)) }}
              />
            </span>
            <span aria-hidden className={cn('font-wds-mono text-[10px] leading-3', b.today ? 'font-semibold text-wds-selected-edge' : 'text-wds-text-secondary')}>
              {b.letter}
            </span>
          </li>
        ))}
      </ul>
      {footer ? <div className="border-t border-wds-border pt-3">{footer}</div> : <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{caption}</p>}
    </section>
  );
}

export interface DayStripItem {
  value: string;
  /** "MON". */
  dow: string;
  /** "12". */
  day: string;
}

export function DayStrip({ days, value, onChange, label, today }: { days: readonly DayStripItem[]; value: string; onChange: (value: string) => void; label: string; /** The `value` of today, marked with an amber bar under its number. */ today?: string }) {
  const refs = React.useRef(new Map<string, HTMLButtonElement>());
  const values = days.map((d) => d.value);
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 border-b border-wds-border bg-wds-surface px-2 py-3">
      {days.map((d) => {
        const chosen = d.value === value;
        return (
          <button
            key={d.value}
            ref={(el) => {
              if (el) refs.current.set(d.value, el);
              else refs.current.delete(d.value);
            }}
            type="button"
            role="radio"
            aria-checked={chosen}
            aria-label={`${d.dow} ${d.day}${d.value === today ? ', today' : ''}`}
            tabIndex={chosen ? 0 : -1}
            onClick={() => onChange(d.value)}
            onKeyDown={(e) => {
              const next = nextInGroup(e.key, values, value);
              if (next === null) return;
              e.preventDefault();
              onChange(next);
              refs.current.get(next)?.focus();
            }}
            className={cn('flex min-h-[44px] grow basis-0 flex-col items-center gap-0.5 py-1.5', MOTION, FOCUS_RING, chosen ? 'bg-wds-text-ink' : onHover('bg-wds-neutral-50'))}
          >
            <span aria-hidden className={cn('font-wds-mono text-[10px] leading-3', chosen ? 'text-wds-border-strong' : 'text-wds-text-secondary')}>
              {d.dow}
            </span>
            <span aria-hidden className={cn('font-wds-sans text-[15px] leading-[18px]', chosen ? 'font-semibold text-wds-primary-fg' : 'text-wds-text-ink')}>
              {d.day}
            </span>
            <span aria-hidden className={cn('h-0.5 w-4', d.value === today ? 'bg-wds-caramel-600' : 'bg-transparent')} />
          </button>
        );
      })}
    </div>
  );
}

export function DayCard({
  day,
  today = false,
  todayLabel = 'TODAY',
  shift,
  changedNote,
  dayOff = false,
  dayOffLabel = 'Day off',
}: {
  /** "Mon 12". */
  day: string;
  today?: boolean;
  todayLabel?: string;
  shift?: { tone: ShiftTone; label: string };
  /** "Changed from Morning · Faith Njeri, 16:49": turns the card amber. */
  changedNote?: string;
  dayOff?: boolean;
  dayOffLabel?: string;
}) {
  const chip = shift ? (
    <span className={cn('flex h-[30px] items-center justify-center border font-wds-mono text-[12px] leading-4', SHIFT_PAINT[shift.tone].chip)}>{shift.label}</span>
  ) : null;
  return (
    <li
      aria-current={today ? 'date' : undefined}
      className={cn(
        'flex items-center gap-3 border px-3.5 py-3',
        dayOff ? 'border-wds-border bg-wds-neutral-100' : changedNote ? 'border-wds-warning-border bg-wds-warning-bg' : 'border-wds-border bg-wds-surface',
        today && 'border-l-[3px] border-l-wds-selected-edge border-y-wds-espresso-200 border-r-wds-espresso-200'
      )}
    >
      <div className="flex w-16 shrink-0 flex-col">
        {today ? <span className="font-wds-mono text-[10px] font-semibold leading-3 text-wds-selected-edge">{todayLabel}</span> : null}
        <span className={cn('font-wds-sans text-[15px] leading-[18px]', dayOff ? 'text-wds-text-secondary' : 'font-semibold text-wds-text-ink')}>{day}</span>
      </div>
      {dayOff ? (
        <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{dayOffLabel}</span>
      ) : (
        <div className="flex min-w-0 grow basis-0 flex-col gap-[3px]">
          {chip}
          {changedNote ? <span className="font-wds-sans text-[11px] leading-[14px] text-wds-warning-fg">{changedNote}</span> : null}
        </div>
      )}
    </li>
  );
}

export function TimeRow({
  day,
  range,
  hours,
  state = 'ok',
  note,
  report,
}: {
  /** "Mon 5". */
  day: string;
  /** "05:58 → 14:01". */
  range: string;
  /** "8 h 03": make it with `formatHoursMinutes`. */
  hours: string;
  /** `ok` green tick; `short` amber tick; `problem` red bar with the note and the report button. */
  state?: 'ok' | 'short' | 'problem';
  /** "Clocked out early. Is this wrong?" (problem only) */
  note?: string;
  /** The report button; pass it only if the person may report (problem only). */
  report?: { label: string; onClick: () => void };
}) {
  const problem = state === 'problem';
  return (
    <li className={cn('flex flex-col gap-1.5 border border-wds-border bg-wds-surface px-3.5 py-3', problem && 'border-l-[3px] border-l-wds-error-fg')}>
      <div className="flex items-center gap-2.5">
        <span className="w-[52px] shrink-0 whitespace-nowrap font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{day}</span>
        <span className={cn('grow basis-0 font-wds-mono text-[12px] leading-4', problem ? 'text-wds-error-fg' : 'text-wds-text-ink')}>{range}</span>
        <span className={cn('font-wds-sans text-[12px] leading-4', state === 'ok' ? 'text-wds-success-fg' : 'text-wds-warning-fg')}>
          {state === 'problem' ? '' : '✓ '}
          {hours}
        </span>
      </div>
      {problem && (note || report) ? (
        <div className="flex items-center justify-between gap-3">
          {note ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{note}</span> : null}
          {report ? (
            <button type="button" onClick={report.onClick} className={cn("relative flex h-[30px] shrink-0 items-center border border-wds-primary px-3 font-wds-sans text-[12px] font-medium leading-4 text-wds-primary after:absolute after:inset-x-0 after:-inset-y-[7px] after:content-['']", MOTION, FOCUS_RING, PRESSED, onHover('bg-wds-neutral-50'))}>
              {report.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
