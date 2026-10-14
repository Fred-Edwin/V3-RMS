'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { roleLabel } from '@/components/app/shell/role-label';
import { Skeleton } from '@/components/ui2/skeleton';
import { cn } from '@/lib/cn';
import type { AppRole } from '@/types/auth';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import type { Person } from '../../types';

/**
 * The parts every Store Attendant Purchasing phone screen shares (Paper chapter 9, 28A to 28Q; values in
 * docs/features/inventory/block-6-paper-spec.md §1). The dark header is `B2Header`, the tracker is `CompactTracker`, the pager is
 * `PagerBar`: nothing here repeats them.
 */

// --- People, dates and words ---------------------------------------------------------------------------------------------------------

/** "Joseph Kamau.Store Manager": a person is always named with their role, written Name.Role (owner, 11 Oct 2026). */
export const withRole = (p: Person | null | undefined, fallback = 'the Store Manager'): string => (p ? `${p.name.replace(/\s*\([^)]*\)\s*$/, '')}.${roleText(p.role)}` : fallback);

/** The server names a person's role in words ("Store Manager"); a few lists (the collectors) send the role code, which gets its words here. */
export const roleText = (role: string): string => (/^[A-Z_]+$/.test(role) ? roleLabel(role as AppRole) : role);

/** The role on its own, for "NOTE FOR …" labels. */
export const nameOnly = (p: Person | null | undefined): string => p?.name ?? 'the Store Manager';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NAIROBI = 'Africa/Nairobi';

interface NairobiParts {
  y: number;
  m: number;
  d: number;
  wd: number;
  hh: number;
  mm: number;
}

/** The Nairobi wall-clock parts of an instant or a `YYYY-MM-DD` day. */
export function nairobi(value: string | Date): NairobiParts {
  if (typeof value === 'string' && value.length === 10) {
    const date = new Date(`${value}T00:00:00Z`);
    return { y: date.getUTCFullYear(), m: date.getUTCMonth(), d: date.getUTCDate(), wd: date.getUTCDay(), hh: 0, mm: 0 };
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(date).map((p) => [p.type, p.value]));
  const y = Number(parts.year);
  const m = Number(parts.month) - 1;
  const d = Number(parts.day);
  return { y, m, d, wd: new Date(Date.UTC(y, m, d)).getUTCDay(), hh: Number(parts.hour), mm: Number(parts.minute) };
}

/** "Sat 10 Oct". */
export const dayLabel = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const p = nairobi(value);
  return `${WEEKDAYS[p.wd]} ${p.d} ${MONTHS[p.m]}`;
};

/** "10 Oct" (history rows: "Paid · 10 Oct"). */
export const shortDay = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const p = nairobi(value);
  return `${p.d} ${MONTHS[p.m]}`;
};

/** "09:05" in lists and activity (Q-17). */
export const timeHHmm = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const p = nairobi(value);
  return `${String(p.hh).padStart(2, '0')}:${String(p.mm).padStart(2, '0')}`;
};

/** "9:05" inside a sentence (Q-17). */
export const timeHmm = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const p = nairobi(value);
  return `${p.hh}:${String(p.mm).padStart(2, '0')}`;
};

/** "9:05" for today, "Thu 8 Oct 9:05" for an earlier day (a status line that says "since …"). */
export const sinceLabel = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const then = nairobi(value);
  const now = nairobi(new Date());
  return then.y === now.y && then.m === now.m && then.d === now.d ? timeHmm(value) : `${dayLabel(value)} ${timeHmm(value)}`;
};

/** "Thu 8 Oct · 10:30". */
export const dayAndTime = (value: string | Date | null | undefined): string => (value ? `${dayLabel(value)} · ${timeHHmm(value)}` : '—');

/** "Saturday 10 Oct" for the Home subtitle. */
export const longDayLabel = (iso: string): string => {
  const p = nairobi(iso);
  return `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][p.wd]} ${p.d} ${MONTHS[p.m]}`;
};

/** "1 item" / "3 items". */
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

// --- The screen frame ------------------------------------------------------------------------------------------------------------------

/** The phone-width column every screen sits in (the shell has no bottom tabs), with a scrolling body and room for a sticky bar. */
export function PhoneScreen({ header, children, bar }: { header: React.ReactNode; children: React.ReactNode; bar?: React.ReactNode }) {
  return (
    <PhoneColumn>
      {header}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-wds-canvas">{children}</main>
      {bar}
    </PhoneColumn>
  );
}

/**
 * Back goes to the page we came from; with no history (a link opened cold) it goes to `fallback`.
 * A list screen (Restock list, My orders, History, Levels, Search) passes `parent: true`: Back always goes to `fallback`, its parent.
 * Walking the browser history from a list screen can land on a page that is not part of the Attendant's flow (a sign-in redirect,
 * another screen that loads differently), so a list screen's Back no longer depends on it.
 */
export function useGoBack(fallback: string, options?: { parent?: boolean }): () => void {
  const router = useRouter();
  const parent = options?.parent ?? false;
  return React.useCallback(() => {
    if (!parent && typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push(fallback);
  }, [router, fallback, parent]);
}

// --- Header search -----------------------------------------------------------------------------------------------------------------------

const SEARCH_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
    <circle cx="11" cy="11" r="7" fill="none" stroke="#847E76" strokeWidth="2" />
    <path d="M16.5 16.5L21 21" stroke="#847E76" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** The white search field in the dark header (44 high). An input that edits, or (with `onOpen`) a button that opens Search. */
export function HeaderSearch({ value, onChange, placeholder, onOpen, label }: { value?: string; onChange?: (v: string) => void; placeholder: string; onOpen?: () => void; label: string }) {
  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} aria-label={label} className="flex h-11 w-full items-center gap-2.5 rounded-[2px] bg-white px-3.5 text-left font-wds-sans text-[14px] leading-[18px] text-wds-text-faint outline-none focus-visible:shadow-wds-ring">
        {SEARCH_ICON}
        {placeholder}
      </button>
    );
  }
  return (
    <label className="flex h-11 w-full items-center gap-2.5 rounded-[2px] bg-white px-3.5 focus-within:shadow-wds-ring">
      {SEARCH_ICON}
      <input
        type="search"
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent font-wds-sans text-[14px] leading-[18px] text-wds-text-ink outline-none placeholder:text-wds-text-faint [&::-webkit-search-cancel-button]:hidden"
      />
    </label>
  );
}

/** The caramel link at the right of a dark header ("History ›", "Mark all read"). */
export function HeaderLink({ children, href, onClick, disabled }: { children: React.ReactNode; href?: string; onClick?: () => void; disabled?: boolean }) {
  const cls = 'flex min-h-11 shrink-0 items-end pb-1 font-wds-sans text-[13px] leading-4 text-wds-caramel-300 outline-none focus-visible:shadow-wds-ring disabled:opacity-50';
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

/** A search box whose text is kept in the page address after a short pause (`q`), so Back and a shared link keep it. */
export function useDebouncedQuery(initial: string, commit: (q: string) => void, delay = 250): [string, (q: string) => void] {
  const [text, setText] = React.useState(initial);
  const commitRef = React.useRef(commit);
  React.useEffect(() => {
    commitRef.current = commit;
  });
  React.useEffect(() => {
    const t = window.setTimeout(() => commitRef.current(text), delay);
    return () => window.clearTimeout(t);
  }, [text, delay]);
  return [text, setText];
}

// --- Chips, labels, status ---------------------------------------------------------------------------------------------------------------

/** Brings a control that Paper draws shorter than 44 px up to a 44 px tap area without changing how it looks. */
export const HIT = "relative before:absolute before:inset-x-0 before:-inset-y-[7px] before:content-['']";

export interface FilterChip {
  key: string;
  label: string;
  count?: number;
  dot?: 'error' | 'warning';
}

/** The filter chip row (Paper 1.3): white band, 30 px square-cornered chips, "Label · count". Several of them are a filter; `By supplier` is a mode, so it is a chip too. */
export function FilterChips({ chips, active, onChange, label }: { chips: readonly FilterChip[]; active: string; onChange: (key: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 gap-2 overflow-x-auto border-b border-wds-border bg-white px-5 py-3">
      {chips.map((chip) => {
        const on = chip.key === active;
        return (
          <button
            key={chip.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(chip.key)}
            className={cn(
              HIT,
              'flex h-[30px] shrink-0 items-center rounded-[2px] px-3 font-wds-sans text-[12px] leading-4 outline-none transition-colors duration-100 focus-visible:shadow-wds-ring',
              on ? 'bg-wds-espresso-700 font-medium text-[#FCF7F2]' : 'border border-wds-border-strong bg-white font-normal text-wds-text-ink hover:bg-wds-neutral-50',
            )}
          >
            {chip.dot ? <span aria-hidden="true" className={cn('mr-1.5 size-1.5 rounded-full', chip.dot === 'error' ? 'bg-wds-error-fg' : 'bg-wds-warning-fg')} /> : null}
            {chip.label}
            {chip.count !== undefined ? ` · ${chip.count}` : ''}
          </button>
        );
      })}
    </div>
  );
}

/** "NEEDS YOU NOW · 2": mono 11/14, tracked, muted. */
export function Label({ children, className, id, small = false, tone }: { children: React.ReactNode; className?: string; id?: string; small?: boolean; tone?: 'error' | 'warning' }) {
  return (
    <h2
      id={id}
      className={cn(
        'font-wds-mono uppercase',
        small ? 'text-[10px] leading-3 tracking-[0.06em]' : 'text-[11px] leading-[14px] tracking-[0.08em]',
        tone === 'error' ? 'text-wds-error-fg' : tone === 'warning' ? 'text-wds-warning-fg' : 'text-wds-text-secondary',
        className,
      )}
    >
      {children}
    </h2>
  );
}

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'muted' | 'amber';

const TONE_TEXT: Record<Tone, string> = { success: 'text-wds-success-fg', warning: 'text-wds-warning-fg', error: 'text-wds-error-fg', info: 'text-wds-info-fg', muted: 'text-wds-text-secondary', amber: 'text-wds-text-secondary' };
const TONE_DOT: Record<Tone, string> = { success: 'bg-wds-success-fg', warning: 'bg-wds-warning-fg', error: 'bg-wds-error-fg', info: 'bg-wds-info-fg', muted: 'bg-wds-text-faint', amber: 'bg-[#B5823E]' };

/** A 6 px dot and a 12/16 line in the same tone ("0 left · reorder at 8 jerrican"). `plain` keeps the text muted and tints only the dot. */
export function StatusLine({ tone, children, plain = false, className, medium = false }: { tone: Tone; children: React.ReactNode; plain?: boolean; className?: string; medium?: boolean }) {
  return (
    <p className={cn('flex items-center gap-1.5 font-wds-sans text-[12px] leading-4', medium && 'font-medium', plain ? 'text-wds-text-secondary' : TONE_TEXT[tone], className)}>
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[tone])} />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

const PILL: Record<'success' | 'warning' | 'error' | 'info', string> = {
  success: 'border-wds-success-border bg-wds-success-bg text-wds-success-fg',
  warning: 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg',
  error: 'border-wds-error-border bg-wds-error-bg text-wds-error-fg',
  info: 'border-wds-info-border bg-wds-info-bg text-wds-info-fg',
};

/** The square status pill (padding 3 × 8, 11/14). `dot` puts a 6 px dot in front (the "3 out" / "5 low" chips of Home). */
export function Pill({ tone, children, dot = false }: { tone: keyof typeof PILL; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border px-2 py-[3px] font-wds-sans text-[11px] leading-[14px]', PILL[tone])}>
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

// --- Cards -------------------------------------------------------------------------------------------------------------------------------------

export function Card({ children, className, error = false }: { children: React.ReactNode; className?: string; error?: boolean }) {
  return <div className={cn('rounded-[4px] border bg-white', error ? 'border-wds-error-border' : 'border-wds-border', className)}>{children}</div>;
}

/** A card of item lines: a label strip and rows (name left, quantity and price right). */
export function ItemsCard({ heading, children, labelId }: { heading: string; children: React.ReactNode; labelId: string }) {
  return (
    <section aria-labelledby={labelId}>
      <Card>
        <div className="border-b border-wds-border px-3.5 py-2.5">
          <Label id={labelId}>{heading}</Label>
        </div>
        <ul>{children}</ul>
      </Card>
    </section>
  );
}

export function ItemRow({ name, right, children }: { name: string; right: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-wds-border px-3.5 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{name}</p>
        {children}
      </div>
      <p className="shrink-0 font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{right}</p>
    </li>
  );
}

// --- Buttons -----------------------------------------------------------------------------------------------------------------------------------

const PRIMARY =
  'flex shrink-0 items-center justify-center rounded-[2px] bg-wds-gradient-primary font-wds-sans font-medium text-[#FCF7F2] shadow-[inset_0_1px_0_#FFFFFF26] outline-none transition-[filter,opacity] duration-100 focus-visible:shadow-wds-ring [@media(hover:hover)]:hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-[0.45]';
const SECONDARY =
  'flex shrink-0 items-center justify-center border border-wds-border-strong bg-white font-wds-sans font-medium text-wds-text-ink outline-none transition-colors duration-100 focus-visible:shadow-wds-ring [@media(hover:hover)]:hover:bg-wds-neutral-50 active:bg-wds-neutral-100 disabled:cursor-not-allowed disabled:opacity-50';

type ButtonSize = 'bar' | 'list' | 'card' | 'inline' | 'wide';
const SIZE: Record<ButtonSize, string> = {
  bar: 'h-12 w-full text-[15px] leading-5',
  list: 'h-[46px] w-full text-[15px] leading-5',
  card: 'h-[38px] text-[13px] leading-4',
  inline: 'h-[34px] w-[84px] text-[13px] leading-4',
  wide: 'h-8 w-32 text-[13px] leading-4',
};

interface ButtonProps {
  children: React.ReactNode;
  size?: ButtonSize;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  href?: string;
  type?: 'button' | 'submit';
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-busy'?: boolean;
}

function build(kind: 'primary' | 'secondary', { children, size = 'bar', className, onClick, disabled, href, type = 'button', ...aria }: ButtonProps) {
  const cls = cn(kind === 'primary' ? PRIMARY : SECONDARY, SIZE[size], size !== 'bar' && size !== 'list' && HIT, kind === 'secondary' && size === 'card' && 'font-normal', className);
  if (href && !disabled) {
    return (
      <Link href={href} onClick={onClick} className={cls} {...aria}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} {...aria}>
      {children}
    </button>
  );
}

export const PrimaryButton = (props: ButtonProps) => build('primary', props);
export const SecondaryButton = (props: ButtonProps) => build('secondary', props);

/** "Withdraw this order": a plain 13/16 error-coloured action, centred. */
export function DangerTextAction({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex min-h-11 items-center justify-center font-wds-sans text-[13px] leading-4 text-wds-error-fg outline-none focus-visible:shadow-wds-ring disabled:opacity-50">
      {children}
    </button>
  );
}

const BANNER: Record<'success' | 'warning' | 'error' | 'info', { box: string; title: string }> = {
  success: { box: 'border-wds-success-border bg-wds-success-bg', title: 'text-wds-success-fg' },
  warning: { box: 'border-wds-warning-border bg-wds-warning-bg', title: 'text-wds-warning-fg' },
  error: { box: 'border-wds-error-border bg-wds-error-bg', title: 'text-wds-error-fg' },
  info: { box: 'border-wds-info-border bg-wds-info-bg', title: 'text-wds-info-fg' },
};

/** The order page banner (Paper 28D to 28L): tone card, a 14/18 title in the tone colour and a 13/18 line. `small` is 28H's 13/16 title. */
export function Banner({ tone, title, children, small = false }: { tone: keyof typeof BANNER; title: string; children?: React.ReactNode; small?: boolean }) {
  return (
    <section role="status" className={cn('flex flex-col gap-1 rounded-[4px] border px-3.5 py-3', BANNER[tone].box)}>
      <h2 className={cn('font-wds-sans font-semibold', small ? 'text-[13px] leading-4' : 'text-[14px] leading-[18px]', BANNER[tone].title)}>{title}</h2>
      {children ? <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{children}</p> : null}
    </section>
  );
}

/** A small text link (13/16, or 12/16 for "See all") in the primary colour. */
export function LinkAction({ children, href, onClick, small = false, className, newTab = false }: { children: React.ReactNode; href?: string; onClick?: () => void; small?: boolean; className?: string; newTab?: boolean }) {
  const cls = cn('flex min-h-11 items-center font-wds-sans font-normal text-[var(--wds-primary-btn-start)] outline-none focus-visible:shadow-wds-ring', small ? 'text-[12px] leading-4' : 'text-[13px] leading-4', className);
  return href ? (
    <Link href={href} className={cls} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/** The sticky bar (Paper 1.8): never scrolls with the content; the bottom padding clears the phone's home bar. */
export function PhoneBar({ children, gap = 8 }: { children: React.ReactNode; gap?: 8 | 10 | 14 }) {
  return <footer className={cn('flex shrink-0 flex-col border-t border-wds-border bg-white px-5 pb-7 pt-3', gap === 8 ? 'gap-2' : gap === 10 ? 'gap-2.5' : 'gap-3.5')}>{children}</footer>;
}

// --- The States kit (Paper 28Q) ---------------------------------------------------------------------------------------------------------

/** Loading: grey bars, no spinner. `card` wraps each row in a white card (Home's three cards). */
export function PhoneLoading({ rows = 4, card = false, label = 'Loading' }: { rows?: number; card?: boolean; label?: string }) {
  const first = [150, 120, 170];
  const second = [210, 180, 140];
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn('flex flex-col', card ? 'gap-2.5 px-5 py-4' : 'gap-3 px-5 py-3')}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className={cn('flex flex-col gap-1.5', card ? 'rounded-[4px] border border-wds-border bg-white p-3.5' : 'border-b border-wds-border pb-3')}>
          <Skeleton className="h-3 max-w-full" style={{ width: first[i % 3] }} />
          <Skeleton className="h-2.5 max-w-full" style={{ width: second[i % 3] }} />
        </div>
      ))}
    </div>
  );
}

/** Empty: a title, one line, at most one button. */
export function PhoneEmpty({ title, line, action }: { title: string; line: string; action?: { label: string; href?: string; onClick?: () => void } }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-5 py-10 text-center">
      <p className="font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-text-ink">{title}</p>
      <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{line}</p>
      {action ? (
        <div className="mt-1.5">
          <SecondaryButton size="card" href={action.href} onClick={action.onClick} className="min-w-[130px] px-4 font-medium">
            {action.label}
          </SecondaryButton>
        </div>
      ) : null}
    </div>
  );
}

/** Error: a red card that keeps what was on screen (put it above the content). `message` is the server's plain words when it gave any. */
export function PhoneError({ onRetry, message, className }: { onRetry: () => void; message?: string | null; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-start gap-1.5 border border-wds-error-border bg-wds-error-bg px-3.5 py-3', className)}>
      <p className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-error-fg">Couldn&apos;t load this</p>
      <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{message ?? 'Check your connection and try again.'}</p>
      <button type="button" onClick={onRetry} className={cn(HIT, 'font-wds-sans text-[13px] font-medium leading-4 text-wds-error-fg outline-none focus-visible:shadow-wds-ring')}>
        Try again
      </button>
    </div>
  );
}

/** A refused write (send, withdraw, remind…): the server's words in a red card; what the person typed stays. */
export function WriteError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="border border-wds-error-border bg-wds-error-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
      {children}
    </p>
  );
}
