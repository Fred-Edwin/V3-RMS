'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { DISABLED, FOCUS_RING, MOTION, PRESSED, onHover } from '../lib/interaction';
import { nextInGroup } from '../lib/roving';
import { SHIFT_PAINT, type ShiftTone } from '../lib/shift-palette';

/**
 * Phone pieces for the staff screens (390 px wide in Paper). Presentational: words and numbers
 * come in as props. The dark band is the sidebar's warm dark (`--wds-sidebar-top`).
 *
 * - `PhoneDarkHeader`  back link + mono kicker, then a title or a big mono figure (Paper 1CGK-0, 1CHN-0)
 * - `TimerChip`        dot + mono time in the bar: grey, green or amber (19UZ-0, 19XP-0)
 * - `PhoneHero`        avatar ring, greeting and subtitle under the bar (19V2-0)
 * - `ClockCard`        shift label, status, the 52 px timer, a progress bar with hour ticks and a "now"
 *                      marker, the clock buttons and a helper line (19V9-0, 19XZ-0)
 * - `WeekBars`         "This week": seven bars and a caption (19VJ-0)
 * - `DayStrip`         MON 12 ... SUN 18, the chosen day filled ink (199L-0)
 * - `PhonePrompt`      a full-screen question: kicker, 30 px title, body, a slot, buttons at the bottom (19FF-0)
 * - `PhoneButton`      the tall phone buttons
 * - `DayCard`, `TimeRow`  one day of the rota; one day of last week's hours (1CGR-0, 1CHU-0)
 */

const DARK = 'bg-wds-sidebar-top';
const ON_DARK = 'text-wds-sidebar-fg-active';
const MUTED_ON_DARK = 'text-wds-sidebar-fg-item';
/** Paper draws the chip a step lighter than the band (#3A2A1A on #2E1806); built from the band token. */
const CHIP_GREY = 'border-[color-mix(in_oklab,var(--wds-sidebar-top)_80%,white)] bg-[color-mix(in_oklab,var(--wds-sidebar-top)_90%,white)]';

export function PhoneDarkHeader({
  kicker,
  onBack,
  backLabel = 'Back',
  trailing,
  title,
  figure,
  subtitle,
  className,
}: {
  /** "MY TIME · ROTA". */
  kicker: string;
  /** Present when there is somewhere to go back to. */
  onBack?: () => void;
  backLabel?: string;
  /** Something at the right of the bar (a `TimerChip`). */
  trailing?: React.ReactNode;
  title?: string;
  /** A big mono figure instead of a title ("38 h 10"). */
  figure?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col', DARK, className)}>
      <div className="flex h-14 items-center gap-3 px-3.5">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label={backLabel} className={cn('-ml-1 flex h-11 w-11 items-center justify-center font-wds-sans text-[20px] leading-6', ON_DARK, FOCUS_RING, MOTION, PRESSED)}>
            <span aria-hidden>‹</span>
          </button>
        ) : null}
        <span className={cn('min-w-0 grow font-wds-mono text-[11px] leading-[14px] tracking-[0.06em]', MUTED_ON_DARK)}>{kicker}</span>
        {trailing}
      </div>
      {title || figure || subtitle ? (
        <div className="flex flex-col gap-0.5 px-4 pb-3 pt-4">
          {title ? <h1 className={cn('m-0 font-wds-sans text-[22px] font-semibold leading-7 tracking-[-0.02em]', ON_DARK)}>{title}</h1> : null}
          {figure ? <p className={cn('m-0 font-wds-mono text-[34px] font-medium leading-[42px] tracking-[-0.03em]', ON_DARK)}>{figure}</p> : null}
          {subtitle ? <p className={cn('m-0 font-wds-sans text-[13px] leading-4', MUTED_ON_DARK)}>{subtitle}</p> : null}
        </div>
      ) : null}
    </header>
  );
}

export function TimerChip({ tone, time, label }: { tone: 'grey' | 'green' | 'amber'; time: string; /** Spoken: "Shift starts in". */ label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-[30px] items-center gap-[7px] border px-[11px]',
        tone === 'grey' && CHIP_GREY,
        tone === 'green' && 'border-wds-success-border bg-wds-success-fg',
        // Paper's amber chip is not drawn in the screens read; the warning/caramel tokens are used (README).
        tone === 'amber' && 'border-wds-caramel-600 bg-wds-warning-fg'
      )}
    >
      <span aria-hidden className={cn('h-[7px] w-[7px] rounded-full', tone === 'grey' ? 'bg-wds-text-faint' : tone === 'green' ? 'bg-wds-success-border' : 'bg-wds-caramel-500')} />
      {label ? <span className="sr-only">{label} </span> : null}
      <span className={cn('font-wds-mono text-[12px] font-medium leading-4', ON_DARK)}>{time}</span>
    </span>
  );
}

export function PhoneHero({ name, greeting, subtitle, photoUrl }: { name: string; greeting: string; subtitle: string; photoUrl?: string | null }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div className={cn('flex items-center gap-3.5 px-5 pb-[46px] pt-1.5', DARK)}>
      <span
        role="img"
        aria-label={name}
        className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-wds-espresso-100 to-[color-mix(in_oklab,var(--wds-espresso-200)_75%,var(--wds-espresso-700))] font-wds-sans text-[19px] font-medium leading-6 text-wds-espresso-800 shadow-[0_0_0_2px_var(--wds-sidebar-top),0_0_0_3px_var(--wds-caramel-500)]"
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- small remote avatar
          <img src={photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden>{initials}</span>
        )}
      </span>
      <div className="flex min-w-0 flex-col gap-[3px]">
        <h1 className={cn('m-0 font-wds-sans text-[23px] font-semibold leading-7 tracking-[-0.02em]', ON_DARK)}>{greeting}</h1>
        <p className={cn('m-0 font-wds-sans text-[13px] leading-4', MUTED_ON_DARK)}>{subtitle}</p>
      </div>
    </div>
  );
}

export function PhoneButton({
  kind = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `primary` brown; `outlined` grey border; `brownOutline` espresso border (Clock out). */
  kind?: 'primary' | 'outlined' | 'brownOutline';
  /** `sm` 46, `md` 52, `lg` 56 px high. */
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center justify-center font-wds-sans',
        size === 'lg' ? 'h-14' : size === 'md' ? 'h-[52px]' : 'h-[46px]',
        MOTION,
        FOCUS_RING,
        PRESSED,
        DISABLED,
        kind === 'primary' && cn('bg-wds-primary text-wds-primary-fg', size === 'lg' ? 'text-[17px] font-semibold leading-[22px]' : 'text-[16px] font-semibold leading-5', onHover('bg-wds-primary-hover')),
        kind === 'outlined' && cn('border border-wds-border-strong text-[15px] font-medium leading-[18px] text-wds-text-ink', onHover('bg-wds-neutral-50')),
        kind === 'brownOutline' && cn('border border-wds-primary text-[15px] font-medium leading-[18px] text-wds-primary', onHover('bg-wds-neutral-50')),
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ClockCard({
  shiftLabel,
  statusLabel,
  statusTone = 'muted',
  timer,
  caption,
  progress,
  actions,
  helper,
}: {
  /** "MORNING · 06:00 TO 14:00". */
  shiftLabel: string;
  /** "NOT IN YET" or "ON SHIFT". */
  statusLabel: string;
  statusTone?: 'muted' | 'on' | 'warning';
  /** "00:12:00": make it with `formatHms`. */
  timer: string;
  caption: string;
  /** Percent through the shift, with the hour labels under the bar. */
  progress?: { percent: number; ticks: readonly string[]; label: string };
  /** `PhoneButton`s: only the ones the viewer may press. */
  actions?: React.ReactNode;
  helper?: string;
}) {
  const percent = progress ? Math.min(100, Math.max(0, progress.percent)) : 0;
  return (
    <section
      aria-label="Your shift"
      className="flex flex-col gap-4 border border-l-[3px] border-wds-espresso-200 border-l-wds-caramel-600 bg-gradient-to-br from-wds-surface to-wds-neutral-100 py-[18px] pl-5 pr-[18px] shadow-[0_14px_28px_-16px_color-mix(in_oklab,var(--wds-espresso-800)_28%,transparent)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-wds-mono text-[11px] leading-[14px] tracking-[0.06em] text-wds-primary">{shiftLabel}</span>
        <span className={cn('flex items-center gap-1.5 font-wds-mono text-[11px] leading-[14px] tracking-[0.06em]', statusTone === 'on' ? 'text-wds-success-fg' : statusTone === 'warning' ? 'text-wds-warning-fg' : 'text-wds-primary')}>
          {statusTone !== 'muted' ? <span aria-hidden className={cn('h-[7px] w-[7px] rounded-full', statusTone === 'on' ? 'bg-wds-success-fg' : 'bg-wds-warning-fg')} /> : null}
          {statusLabel}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <p className="m-0 font-wds-mono text-[52px] font-medium leading-[56px] tracking-[-0.03em] text-wds-text-ink">{timer}</p>
        <p className="m-0 font-wds-sans text-[13px] leading-4 text-wds-neutral-700">{caption}</p>
      </div>
      {progress ? (
        <div className="flex flex-col gap-1.5">
          <div role="progressbar" aria-label={progress.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} className="relative h-2 bg-[color-mix(in_oklab,var(--wds-espresso-200)_35%,white)]">
            <div className="h-2 bg-wds-success-fg" style={{ width: `${percent}%` }} />
            <div aria-hidden className="absolute -top-[3px] h-3.5 w-0.5 bg-wds-text-ink" style={{ left: `${percent}%` }} />
          </div>
          <div aria-hidden className="flex justify-between font-wds-mono text-[10px] leading-3 text-wds-text-faint">
            {progress.ticks.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      ) : null}
      {actions}
      {helper ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{helper}</p> : null}
    </section>
  );
}

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

export function DayStrip({ days, value, onChange, label }: { days: readonly DayStripItem[]; value: string; onChange: (value: string) => void; label: string }) {
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
            aria-label={`${d.dow} ${d.day}`}
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
          </button>
        );
      })}
    </div>
  );
}

export function PhonePrompt({ kicker, title, body, children, actions, className }: { kicker: string; title: string; body?: string; /** Between the text and the buttons: a note, an `OptionList`. */ children?: React.ReactNode; /** The button stack at the bottom: the brown one first. */ actions?: React.ReactNode; className?: string }) {
  return (
    <section className={cn('flex min-h-full flex-col gap-[18px] bg-wds-surface px-6 pb-6 pt-10', className)}>
      <p className="m-0 font-wds-mono text-[11px] leading-[14px] tracking-[0.06em] text-wds-text-secondary">{kicker}</p>
      <h1 className="m-0 font-wds-sans text-[30px] font-semibold leading-9 tracking-[-0.02em] text-wds-text-ink">{title}</h1>
      {body ? <p className="m-0 font-wds-sans text-[15px] leading-[22px] text-wds-text-secondary">{body}</p> : null}
      {children}
      {actions ? <div className="mt-auto flex flex-col gap-2.5 pt-4">{actions}</div> : null}
    </section>
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
