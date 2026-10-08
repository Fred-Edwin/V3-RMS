'use client';

import * as React from 'react';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';

/**
 * The one date control (Paper step 28, `22BR-0`, reused by steps 13, 56, 57 and 58): a button reading the range ("Last 30 days"),
 * opening a panel with quick picks (Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, Pick a date or range),
 * From / To fields and a two-month calendar. Click one date for a single day, two for a range; later dates cannot be picked;
 * Apply commits, Cancel and Escape discard. `allowAny` adds an "Any time" quick pick and lets `value` be null (no dates).
 * `note` is the line under the calendar. Below 1024px the panel shows one month and stacks the quick picks above it.
 *
 * Keyboard: Enter or Space on the button opens it and moves focus to the first quick pick. Tab stays inside the panel. The
 * calendar is one tab stop; inside it the arrow keys move by day and week, Home and End to the start and end of the week, PageUp
 * and PageDown by month, Enter or Space picks. Escape, Cancel and Apply close it and put focus back on the button.
 */
export interface DateRange {
  from: string;
  to: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const utc = (s: string): Date => new Date(`${s}T00:00:00Z`);
const addDays = (s: string, n: number): string => iso(new Date(utc(s).getTime() + n * 86_400_000));
const longDate = (s: string): string => `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][utc(s).getUTCDay()]} ${utc(s).getUTCDate()} ${MONTHS[utc(s).getUTCMonth()]?.slice(0, 3)} ${utc(s).getUTCFullYear()}`;
const spanDays = (r: DateRange): number => Math.round((utc(r.to).getTime() - utc(r.from).getTime()) / 86_400_000) + 1;
const monthOf = (s: string): { y: number; m: number } => ({ y: utc(s).getUTCFullYear(), m: utc(s).getUTCMonth() });
const monthIndex = (v: { y: number; m: number }): number => v.y * 12 + v.m;

export function presetLabel(r: DateRange, today: string): string {
  if (r.from === r.to) return r.to === today ? 'Today' : r.to === addDays(today, -1) ? 'Yesterday' : longDate(r.to);
  if (r.to === today && spanDays(r) === 7) return 'Last 7 days';
  if (r.to === today && spanDays(r) === 30) return 'Last 30 days';
  return `${longDate(r.from).slice(4)} – ${longDate(r.to).slice(4)}`;
}

/** Where a calendar key takes the focus from `day`, never past `today`; null for a key the grid does not use. */
export function moveDay(day: string, key: string, today: string): string | null {
  const weekday = (utc(day).getUTCDay() + 6) % 7; // Monday is 0
  const sameDayInMonth = (months: number): string => {
    const d = utc(day);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + 1, 0)).getUTCDate();
    return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, Math.min(d.getUTCDate(), last))));
  };
  let target: string;
  switch (key) {
    case 'ArrowLeft':
      target = addDays(day, -1);
      break;
    case 'ArrowRight':
      target = addDays(day, 1);
      break;
    case 'ArrowUp':
      target = addDays(day, -7);
      break;
    case 'ArrowDown':
      target = addDays(day, 7);
      break;
    case 'Home':
      target = addDays(day, -weekday);
      break;
    case 'End':
      target = addDays(day, 6 - weekday);
      break;
    case 'PageUp':
      target = sameDayInMonth(-1);
      break;
    case 'PageDown':
      target = sameDayInMonth(1);
      break;
    default:
      return null;
  }
  return target > today ? today : target;
}

interface MonthProps {
  year: number;
  month: number;
  today: string;
  range: DateRange;
  pending: string | null;
  /** The one day that is a tab stop (roving tabindex). */
  focusDay: string;
  onPick: (d: string) => void;
  onHover: (d: string | null) => void;
  onKey: (day: string, e: React.KeyboardEvent<HTMLButtonElement>) => void;
}

function Month({ year, month, today, range, pending, focusDay, onPick, onHover, onKey }: MonthProps) {
  const headingId = React.useId();
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => iso(new Date(Date.UTC(year, month, i + 1))))];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  return (
    <div className="flex w-[252px] flex-col gap-2">
      <div id={headingId} className="font-wds-sans text-[14px] font-semibold leading-5 text-wds-text-ink">{MONTHS[month]} {year}</div>
      <div role="grid" aria-labelledby={headingId} className="flex flex-col gap-y-px">
        <div className="grid grid-cols-7 font-wds-mono text-[10px] leading-3 text-wds-text-secondary" role="row">
          {WD.map((d) => <span key={d} className="flex h-6 items-center justify-center" role="columnheader">{d}</span>)}
        </div>
        {weeks.map((week, w) => (
          <div key={w} role="row" className="grid grid-cols-7">
            {week.map((d, i) => {
              if (!d) return <span key={`b${i}`} role="gridcell" aria-hidden="true" />;
              const future = d > today;
              const endpoint = d === range.from || d === range.to;
              const inside = d > range.from && d < range.to;
              return (
                <div key={d} role="gridcell" aria-selected={endpoint || inside}>
                  <button
                    type="button"
                    data-day={d}
                    disabled={future}
                    tabIndex={d === focusDay ? 0 : -1}
                    aria-label={longDate(d)}
                    aria-current={d === today ? 'date' : undefined}
                    onClick={() => onPick(d)}
                    onKeyDown={(e) => onKey(d, e)}
                    onMouseEnter={() => pending && onHover(d)}
                    className={cn(
                      'flex h-9 w-full items-center justify-center font-wds-mono text-[12px] leading-4 outline-none transition-colors duration-100 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]',
                      future ? 'cursor-not-allowed text-wds-text-faint' : endpoint ? 'bg-wds-text-ink text-white' : inside ? 'bg-wds-espresso-50 text-wds-text-ink' : 'text-wds-text-ink [@media(hover:hover)]:hover:bg-wds-neutral-100',
                    )}
                  >
                    {Number(d.slice(8))}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

const DEFAULT_NOTE = 'Later dates can’t be picked.';
const FOCUSABLE = 'button:not([disabled]), [tabindex="0"]';

export interface DateRangePickerProps {
  /** Null means "any time" and is only meaningful with `allowAny`. */
  value: DateRange | null;
  /** Today as `YYYY-MM-DD` (the Nairobi day). */
  today: string;
  onChange: (range: DateRange | null) => void;
  allowAny?: boolean;
  note?: string;
  /** The name read out for the button and the dialog, e.g. "Date". */
  label?: string;
  className?: string;
  /** Extra classes for the button that opens the panel (a form row that wants 34px fields, say). */
  buttonClassName?: string;
}

export function DateRangePicker({ value, today, onChange, allowAny = false, note = DEFAULT_NOTE, label = 'Date', className, buttonClassName }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  // Two months side by side from 1024px; one below it (the second would be hidden and could still hold the focus).
  const { matches: wide } = useMediaQuery('(min-width: 1024px)');
  const shownValue: DateRange = value ?? { from: today, to: today };
  const [draft, setDraft] = React.useState<DateRange>(shownValue);
  const [anyDraft, setAnyDraft] = React.useState(value === null);
  const [pending, setPending] = React.useState<string | null>(null);
  const [hover, setHover] = React.useState<string | null>(null);
  const [focusDay, setFocusDay] = React.useState<string>(shownValue.to > today ? today : shownValue.to);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();
  /** Set when a key moved the calendar focus, so the effect below moves the real focus once the right month is drawn. */
  const moveFocus = React.useRef(false);

  /** Closes the panel; `restore` puts focus back on the button (Escape, Cancel, Apply), not after a click elsewhere. */
  const close = React.useCallback((restore: boolean) => {
    setOpen(false);
    if (restore) triggerRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent): void => { if (!rootRef.current?.contains(e.target as Node)) close(false); };
    const esc = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close(true);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, close]);
  const t = utc(today);
  const [view, setView] = React.useState(monthOf(shownValue.from));

  // Reopening starts from the applied range. The dependencies are the range's own values, so a caller passing a fresh object each
  // render does not reset a half-made choice.
  const appliedFrom = shownValue.from;
  const appliedTo = shownValue.to;
  const appliedAny = value === null;
  React.useEffect(() => {
    if (open) {
      setDraft({ from: appliedFrom, to: appliedTo });
      setAnyDraft(appliedAny);
      setPending(null);
      setView(monthOf(appliedFrom));
      setFocusDay(appliedTo > today ? today : appliedTo);
    }
  }, [open, appliedFrom, appliedTo, appliedAny, today]);

  // The panel opens from the button's left edge; when that would run past the screen's right edge (a button near the right of a
  // narrow screen) it slides left by exactly the overflow. Measured before paint, so it never flashes in the wrong place.
  const [shift, setShift] = React.useState(0);
  React.useLayoutEffect(() => {
    if (!open) {
      setShift(0);
      return;
    }
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) setShift(Math.min(0, Math.round(document.documentElement.clientWidth - 8 - (rect.right - shift))));
    // `shift` is the offset already applied, subtracted above so the measurement is of the unshifted position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wide, view.y, view.m]);

  // On open, focus goes into the panel: the quick pick that is on, else the first.
  React.useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const target = panel?.querySelector<HTMLElement>('[data-quick][aria-pressed="true"]') ?? panel?.querySelector<HTMLElement>('[data-quick]');
    target?.focus();
  }, [open]);

  // After a key moved the calendar focus, move the real focus to that day once its month is on screen.
  React.useEffect(() => {
    if (!open || !moveFocus.current) return;
    moveFocus.current = false;
    panelRef.current?.querySelector<HTMLElement>(`[data-day="${focusDay}"]`)?.focus();
  }, [open, focusDay, view]);

  const quick: { label: string; r: DateRange }[] = [
    { label: 'Today', r: { from: today, to: today } },
    { label: 'Yesterday', r: { from: addDays(today, -1), to: addDays(today, -1) } },
    { label: 'Last 7 days', r: { from: addDays(today, -6), to: today } },
    { label: 'Last 30 days', r: { from: addDays(today, -29), to: today } },
    { label: 'This month', r: { from: iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1))), to: today } },
    { label: 'Last month', r: { from: iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1))), to: iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0))) } },
  ];

  const pick = (d: string): void => {
    setAnyDraft(false);
    setFocusDay(d);
    if (!pending) {
      setPending(d);
      setDraft({ from: d, to: d });
    } else {
      setDraft(d < pending ? { from: d, to: pending } : { from: pending, to: d });
      setPending(null);
      setHover(null);
    }
  };
  const shown = pending && hover ? (hover < pending ? { from: hover, to: pending } : { from: pending, to: hover }) : draft;
  const next = view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 };
  const step = (n: number): void => setView((v) => { const d = new Date(Date.UTC(v.y, v.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });

  // The tab stop must be a day that is on screen: if the month moved away from it, the first day shown takes over.
  const visible = (day: string): boolean => {
    const idx = monthIndex(monthOf(day));
    return idx === monthIndex(view) || (wide && idx === monthIndex(next));
  };
  const tabDay = visible(focusDay) ? focusDay : iso(new Date(Date.UTC(view.y, view.m, 1)));

  /** A key inside the calendar: arrows and friends move the focus (and the month when the day leaves the screen). */
  const onDayKey = (day: string, e: React.KeyboardEvent<HTMLButtonElement>): void => {
    const target = moveDay(day, e.key, today);
    if (target === null) return;
    e.preventDefault();
    const tm = monthOf(target);
    const idx = monthIndex(tm);
    const lastShown = monthIndex(view) + (wide ? 1 : 0);
    if (idx < monthIndex(view)) setView(tm);
    else if (idx > lastShown) setView(wide ? (tm.m === 0 ? { y: tm.y - 1, m: 11 } : { y: tm.y, m: tm.m - 1 }) : tm);
    moveFocus.current = true;
    setFocusDay(target);
  };

  /** Tab stays inside the panel: from the last control it wraps to the first, and back. */
  const onPanelKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Tab') return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const nav = 'flex size-8 items-center justify-center font-wds-sans text-[16px] leading-none outline-none hover:bg-wds-neutral-100 focus-visible:shadow-wds-ring max-sm:size-11';
  const quickBtn = 'h-8 px-2 text-left font-wds-sans text-[13px] leading-4 outline-none focus-visible:shadow-wds-ring max-sm:h-11';

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close(true) : setOpen(true))}
        className={cn('flex h-8 items-center gap-2 border border-wds-border-strong bg-wds-surface px-3 font-wds-sans text-[13px] leading-4 text-wds-text-ink outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring max-sm:h-11', buttonClassName)}
      >
        <span className="sr-only">{label}: </span>
        {value === null ? 'Any time' : presetLabel(value, today)}
        <span aria-hidden className="text-wds-text-faint">⌄</span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label={`Choose dates: ${label}`}
          onKeyDown={onPanelKey}
          style={shift !== 0 ? { left: shift } : undefined}
          className="absolute left-0 top-10 z-50 flex max-w-[calc(100vw-16px)] flex-col border border-wds-border-strong bg-wds-surface shadow-wds-md outline-none motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150 lg:flex-row max-sm:top-12"
        >
          <div role="group" aria-label="Quick picks" className="flex shrink-0 flex-col gap-0.5 border-b border-wds-border p-2 lg:w-[168px] lg:border-b-0 lg:border-r">
            <span aria-hidden className="px-2 pb-1 pt-1 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Quick picks</span>
            {allowAny ? (
              <button type="button" data-quick aria-pressed={anyDraft} onClick={() => { setAnyDraft(true); setPending(null); }} className={cn(quickBtn, anyDraft ? 'bg-wds-espresso-50 font-medium text-wds-text-ink' : 'text-wds-text-ink hover:bg-wds-neutral-50')}>
                Any time
              </button>
            ) : null}
            {quick.map((q) => {
              const on = !anyDraft && q.r.from === draft.from && q.r.to === draft.to;
              return (
                <button key={q.label} type="button" data-quick aria-pressed={on} onClick={() => { setAnyDraft(false); setDraft(q.r); setPending(null); setView(monthOf(q.r.from)); setFocusDay(q.r.to); }} className={cn(quickBtn, on ? 'bg-wds-espresso-50 font-medium text-wds-text-ink' : 'text-wds-text-ink hover:bg-wds-neutral-50')}>
                  {q.label}
                </button>
              );
            })}
            <button type="button" data-quick aria-pressed={pending !== null} onClick={() => { setAnyDraft(false); setPending(draft.from); }} className={cn(quickBtn, 'hover:bg-wds-neutral-50', pending ? 'bg-wds-espresso-50 font-medium' : '')}>
              Pick a date or range
            </button>
          </div>
          <div className="flex flex-col gap-3 p-4 lg:w-[560px]">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1"><span className="font-wds-mono text-[10px] uppercase leading-3 text-wds-text-secondary">From</span><span className="flex h-9 w-[150px] items-center border-[1.5px] border-wds-selected-edge px-2.5 font-wds-mono text-[13px]">{longDate(shown.from)}</span></div>
              <span aria-hidden className="pb-2 text-wds-text-secondary">→</span>
              <div className="flex flex-col gap-1"><span className="font-wds-mono text-[10px] uppercase leading-3 text-wds-text-secondary">To</span><span className="flex h-9 w-[150px] items-center border border-wds-border-strong px-2.5 font-wds-mono text-[13px]">{longDate(shown.to)}</span></div>
              <span className="grow pb-1 font-wds-sans text-[12px] leading-4 text-wds-text-secondary" aria-live="polite">{spanDays(shown)} day{spanDays(shown) === 1 ? '' : 's'} · pick one date for a single day, two for a range</span>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-[22px] flex flex-col"><button type="button" aria-label="Previous month" onClick={() => step(-1)} className={nav}>‹</button></div>
              <Month year={view.y} month={view.m} today={today} range={shown} pending={pending} focusDay={tabDay} onPick={pick} onHover={setHover} onKey={onDayKey} />
              {wide ? <Month year={next.y} month={next.m} today={today} range={shown} pending={pending} focusDay={tabDay} onPick={pick} onHover={setHover} onKey={onDayKey} /> : null}
              <div className="mt-[22px] flex flex-col"><button type="button" aria-label="Next month" onClick={() => step(1)} className={nav}>›</button></div>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-wds-border pt-3">
              <p className="max-w-[320px] font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{note}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => close(true)} className="h-9 border border-wds-border-strong bg-wds-surface px-4 font-wds-sans text-[13px] font-medium outline-none hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring max-sm:h-11">Cancel</button>
                <button type="button" onClick={() => { onChange(anyDraft ? null : draft); close(true); }} className="h-9 bg-wds-selected-edge px-4 font-wds-sans text-[13px] font-semibold text-white outline-none hover:brightness-110 focus-visible:shadow-wds-ring max-sm:h-11">Apply</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
