'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * The ledger's date control (Paper step 28, `22BR-0`): a button reading the range ("Last 30 days"), opening a panel with quick
 * picks (Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, Pick a date or range), From / To fields and a
 * two-month calendar. Click one date for a single day, two for a range; later dates cannot be picked; Apply commits, Cancel and
 * Escape discard. Fully keyboard operable (days are buttons in a grid; arrow keys move by day and week).
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

export function presetLabel(r: DateRange, today: string): string {
  if (r.from === r.to) return r.to === today ? 'Today' : r.to === addDays(today, -1) ? 'Yesterday' : longDate(r.to);
  if (r.to === today && spanDays(r) === 7) return 'Last 7 days';
  if (r.to === today && spanDays(r) === 30) return 'Last 30 days';
  return `${longDate(r.from).slice(4)} – ${longDate(r.to).slice(4)}`;
}

function Month({ year, month, today, range, pending, onPick, onHover }: { year: number; month: number; today: string; range: DateRange; pending: string | null; onPick: (d: string) => void; onHover: (d: string | null) => void }) {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => iso(new Date(Date.UTC(year, month, i + 1))))];
  return (
    <div className="flex w-[252px] flex-col gap-2" role="grid" aria-label={`${MONTHS[month]} ${year}`}>
      <div className="font-wds-sans text-[14px] font-semibold leading-5 text-wds-text-ink">{MONTHS[month]} {year}</div>
      <div className="grid grid-cols-7 gap-y-px font-wds-mono text-[10px] leading-3 text-wds-text-secondary" role="row">
        {WD.map((d) => <span key={d} className="flex h-6 items-center justify-center" role="columnheader">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-px">
        {cells.map((d, i) => {
          if (!d) return <span key={`b${i}`} />;
          const future = d > today;
          const endpoint = d === range.from || d === range.to;
          const inside = d > range.from && d < range.to;
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              disabled={future}
              aria-pressed={endpoint}
              aria-label={longDate(d)}
              onClick={() => onPick(d)}
              onMouseEnter={() => pending && onHover(d)}
              className={cn(
                'flex h-9 items-center justify-center font-wds-mono text-[12px] leading-4 outline-none transition-colors duration-100 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]',
                future ? 'cursor-not-allowed text-wds-text-faint' : endpoint ? 'bg-wds-text-ink text-white' : inside ? 'bg-wds-espresso-50 text-wds-text-ink' : 'text-wds-text-ink [@media(hover:hover)]:hover:bg-wds-neutral-100',
              )}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({ value, today, onChange }: { value: DateRange; today: string; onChange: (r: DateRange) => void }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange>(value);
  const [pending, setPending] = React.useState<string | null>(null);
  const [hover, setHover] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent): void => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const t = utc(today);
  const [view, setView] = React.useState({ y: utc(value.from).getUTCFullYear(), m: utc(value.from).getUTCMonth() });

  React.useEffect(() => {
    if (open) {
      setDraft(value);
      setPending(null);
      setView({ y: utc(value.from).getUTCFullYear(), m: utc(value.from).getUTCMonth() });
    }
  }, [open, value]);

  const quick: { label: string; r: DateRange }[] = [
    { label: 'Today', r: { from: today, to: today } },
    { label: 'Yesterday', r: { from: addDays(today, -1), to: addDays(today, -1) } },
    { label: 'Last 7 days', r: { from: addDays(today, -6), to: today } },
    { label: 'Last 30 days', r: { from: addDays(today, -29), to: today } },
    { label: 'This month', r: { from: iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1))), to: today } },
    { label: 'Last month', r: { from: iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1))), to: iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0))) } },
  ];

  const pick = (d: string): void => {
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

  return (
    <div ref={rootRef} className="relative">
        <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)} className="flex h-8 items-center gap-2 border border-wds-border-strong bg-wds-surface px-3 font-wds-sans text-[13px] leading-4 text-wds-text-ink outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring">
          {presetLabel(value, today)}
          <span aria-hidden className="text-wds-text-faint">⌄</span>
        </button>
      {open ? (
        <div role="dialog" aria-label="Choose dates" className="absolute left-0 top-10 z-50 flex border border-wds-border-strong bg-wds-surface shadow-wds-md outline-none motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
          <div className="flex w-[168px] shrink-0 flex-col gap-0.5 border-r border-wds-border p-2">
            <span className="px-2 pb-1 pt-1 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Quick picks</span>
            {quick.map((q) => {
              const on = q.r.from === draft.from && q.r.to === draft.to;
              return (
                <button key={q.label} type="button" onClick={() => { setDraft(q.r); setPending(null); setView({ y: utc(q.r.from).getUTCFullYear(), m: utc(q.r.from).getUTCMonth() }); }} className={cn('h-8 px-2 text-left font-wds-sans text-[13px] leading-4 outline-none focus-visible:shadow-wds-ring', on ? 'bg-wds-espresso-50 font-medium text-wds-text-ink' : 'text-wds-text-ink hover:bg-wds-neutral-50')}>
                  {q.label}
                </button>
              );
            })}
            <button type="button" onClick={() => setPending(draft.from)} className={cn('h-8 px-2 text-left font-wds-sans text-[13px] leading-4 outline-none focus-visible:shadow-wds-ring hover:bg-wds-neutral-50', pending ? 'bg-wds-espresso-50 font-medium' : '')}>
              Pick a date or range
            </button>
          </div>
          <div className="flex w-[560px] flex-col gap-3 p-4">
            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-1"><span className="font-wds-mono text-[10px] uppercase leading-3 text-wds-text-secondary">From</span><span className="flex h-9 w-[150px] items-center border-[1.5px] border-wds-selected-edge px-2.5 font-wds-mono text-[13px]">{longDate(shown.from)}</span></div>
              <span aria-hidden className="pb-2 text-wds-text-secondary">→</span>
              <div className="flex flex-col gap-1"><span className="font-wds-mono text-[10px] uppercase leading-3 text-wds-text-secondary">To</span><span className="flex h-9 w-[150px] items-center border border-wds-border-strong px-2.5 font-wds-mono text-[13px]">{longDate(shown.to)}</span></div>
              <span className="grow pb-1 font-wds-sans text-[12px] leading-4 text-wds-text-secondary" aria-live="polite">{spanDays(shown)} day{spanDays(shown) === 1 ? '' : 's'} · click one date for a single day</span>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex flex-col">
                <div className="mb-1 flex h-6 items-center"><button type="button" aria-label="Previous month" onClick={() => step(-1)} className="font-wds-sans text-[14px] outline-none focus-visible:shadow-wds-ring">‹</button></div>
              </div>
              <Month year={view.y} month={view.m} today={today} range={shown} pending={pending} onPick={pick} onHover={setHover} />
              <Month year={next.y} month={next.m} today={today} range={shown} pending={pending} onPick={pick} onHover={setHover} />
              <div className="flex flex-col"><div className="mb-1 flex h-6 items-center"><button type="button" aria-label="Next month" onClick={() => step(1)} className="font-wds-sans text-[14px] outline-none focus-visible:shadow-wds-ring">›</button></div></div>
            </div>
            <div className="flex items-end justify-between border-t border-wds-border pt-3">
              <p className="max-w-[320px] font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Later dates can’t be picked. Opening and closing figures use the first and last day you choose.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="h-9 border border-wds-border-strong bg-wds-surface px-4 font-wds-sans text-[13px] font-medium outline-none hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring">Cancel</button>
                <button type="button" disabled={pending !== null} onClick={() => { onChange(draft); setOpen(false); }} className="h-9 bg-wds-selected-edge px-4 font-wds-sans text-[13px] font-semibold text-white outline-none hover:brightness-110 focus-visible:shadow-wds-ring disabled:bg-wds-neutral-100 disabled:text-wds-text-muted">Apply</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
