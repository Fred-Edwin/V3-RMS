'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { useAuthStore } from '@/store/authStore';
import { useMobileNavDrawer } from '../hooks/use-mobile-nav-drawer';
import type { ChipSpec, ChipTone } from '../lib/block2-words';
import { initialsOf } from './phone-parts';
import { PHONE_SECONDARY_BUTTON } from '../lib/phone-styles';

/**
 * Parts the Block 2 phone screens share (dispatch packing and files, deliveries): Paper chapters 5, 6, 9 and 10, steps D1 to D12,
 * N1 to N3, G2 and G3. The dark header never carries a status bar. Values are from `get_jsx` on D1, D2 and D5.
 */

// --- Header and tabs ------------------------------------------------------------------------------------------------------------

export interface B2Tab {
  key: string;
  label: string;
  count?: number;
}

export interface B2HeaderProps {
  title: string;
  subtitle: string;
  /** A reference line ("REQ-NYR-0112 · Afternoon · 40 lines") is drawn in Geist Mono. */
  mono?: boolean;
  /** A plain subtitle drawn 12/16 instead of 13/16 (Paper N3a, the member's delivery file). */
  small?: boolean;
  /** A plain subtitle drawn 13/18 instead of 13/16 (Paper D5b, the every-line review). */
  tall?: boolean;
  leading: 'back' | 'menu';
  onBack?: () => void;
  /** The line after "WENDO RMS ·" ("CENTRAL STORE", "NYERI TOWN"). */
  place: string;
  tabs?: { items: readonly B2Tab[]; active: string; onChange: (key: string) => void; label: string };
}

export function B2Header({ title, subtitle, mono = false, small = false, tall = false, leading, onBack, place, tabs }: B2HeaderProps) {
  const initials = useAuthStore((s) => initialsOf(s.user?.name));
  const { open } = useMobileNavDrawer();
  // Paper N2, G3 and G2 (the headers with tabs) are the Counting-style band: 20 px above, a mono 11/14 eyebrow, a 30 px badge, a 22/28
  // title with no tracking, a 13/18 line and the tab row inside; the other screens use the 12 px sans eyebrow of D1 to D12.
  const tabbed = Boolean(tabs);
  return (
    <header className={cn('flex shrink-0 flex-col bg-wds-sidebar-top', tabbed && 'pt-5')}>
      <div className={cn('flex flex-col gap-2.5', tabbed ? 'px-4 pt-1' : 'p-4')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={leading === 'back' ? onBack : open}
              aria-label={leading === 'back' ? 'Back' : 'Open menu'}
              className="-m-3 flex size-11 shrink-0 items-center justify-center rounded-wds-sm text-wds-neutral-50 outline-none transition-opacity duration-150 focus-visible:shadow-wds-ring active:opacity-70"
            >
              {leading === 'back' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 12H5M11 6L5 12L11 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <span className={cn('uppercase text-wds-espresso-400', tabbed ? 'font-wds-mono text-[11px] leading-[14px] tracking-[0.08em]' : 'font-wds-sans text-[12px] leading-4 tracking-[0.06em]')}>WENDO RMS · {place}</span>
          </div>
          <span className={cn('flex shrink-0 items-center justify-center bg-wds-espresso-800 text-[11px] leading-[14px] text-wds-espresso-100', tabbed ? 'size-[30px] rounded-[15px] font-wds-mono' : 'size-7 rounded-[14px] font-wds-sans')} aria-hidden="true">
            {initials}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <h1 className={cn('font-wds-sans text-[22px] font-semibold leading-7 text-wds-neutral-0', !tabbed && 'tracking-[-0.01em]')}>{title}</h1>
          <p className={cn('text-[#B5AEA5]', mono ? 'font-wds-mono text-[12px] leading-4 tracking-[0.02em]' : tabbed || tall ? 'font-wds-sans text-[13px] leading-[18px]' : small ? 'font-wds-sans text-[12px] leading-4' : 'font-wds-sans text-[13px] leading-4')}>{subtitle}</p>
        </div>
        {tabs ? (
          <div className="mt-1.5">
            <B2TabBar {...tabs} />
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** The tab row inside the dark header (G2 "Requisitions | Deliveries", G3 and N2 "To pack | On the way | Done"). */
export function B2TabBar({ items, active, onChange, label }: { items: readonly B2Tab[]; active: string; onChange: (key: string) => void; label: string }) {
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const move = (index: number): void => {
    const next = items[(index + items.length) % items.length];
    if (!next) return;
    onChange(next.key);
    refs.current[next.key]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="flex">
      {items.map((tab, i) => {
        const on = tab.key === active;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              refs.current[tab.key] = el;
            }}
            id={`b2-tab-${tab.key}`}
            role="tab"
            type="button"
            aria-selected={on}
            aria-controls="b2-tabpanel"
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                move(i + 1);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                move(i - 1);
              }
            }}
            className={cn(
              'flex h-10 flex-1 items-center justify-center gap-1.5 border-b-2 font-wds-sans text-[14px] leading-[18px] outline-none transition-colors duration-150 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-caramel-500)]',
              on ? 'border-wds-caramel-500 font-semibold text-white' : 'border-transparent text-[#B5AEA5] hover:text-white',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' && tab.count > 0 ? <span className="font-wds-mono text-[11px] leading-[14px] text-wds-caramel-300">{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** The panel the tab bar controls. */
export function B2TabPanel({ active, children, className }: { active: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id="b2-tabpanel" aria-labelledby={`b2-tab-${active}`} className={className}>
      {children}
    </div>
  );
}

// --- Chips, links, labels ---------------------------------------------------------------------------------------------------------

const CHIP_TONE: Record<ChipTone, string> = {
  neutral: 'border-wds-border-strong bg-wds-neutral-100 text-wds-text-secondary',
  success: 'border-wds-success-border bg-wds-success-bg text-wds-success-fg',
  warning: 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg',
  info: 'border-wds-info-border bg-wds-info-bg text-wds-info-fg',
  error: 'border-wds-error-border bg-wds-error-bg text-wds-error-fg',
  muted: 'border-wds-border-strong bg-wds-neutral-50 text-wds-text-secondary',
};

/**
 * A status chip: a square-cornered box; a dot in front means someone has to act. Options (defaults unchanged): `size="lg"` is Paper's
 * padding 3 9 (24 high); `dot="square"` is Block 4's 6 by 6 square marker; `ring` draws it as a 1.5px ring (the "Not counted" chip).
 */
export function Chip({ spec, className, size = 'default', dotShape = 'round', ring = false }: { spec: ChipSpec; className?: string; size?: 'default' | 'lg'; dotShape?: 'round' | 'square'; ring?: boolean }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border font-wds-sans text-[12px] leading-4', size === 'lg' ? 'px-[9px] py-[3px]' : 'px-2 py-[2px]', CHIP_TONE[spec.tone], className)}>
      {spec.dot ? (
        <span
          className={cn('size-1.5', dotShape === 'round' && 'rounded-full', ring ? 'box-border border-[1.5px] border-[#8D8982]' : 'bg-current')}
          aria-hidden="true"
        />
      ) : null}
      {spec.text}
    </span>
  );
}

/** The plain white chip of a department row ("To pack", "Waiting 13 min"). */
export function OutlineChip({ children, tone = 'plain', className }: { children: React.ReactNode; tone?: 'plain' | 'warning' | 'success' | 'muted'; className?: string }) {
  const toneClass = {
    plain: 'border-wds-border-strong bg-white text-wds-text-secondary',
    muted: 'border-wds-border-strong bg-wds-neutral-100 text-wds-text-secondary',
    warning: 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg',
    success: 'border-wds-success-border bg-wds-success-bg text-wds-success-fg',
  }[tone];
  return <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap border px-2 py-[2px] font-wds-sans text-[12px] leading-4', toneClass, className)}>{children}</span>;
}

/** A document number as Paper draws it: mono, #1F5BAE, underlined; a link when it has somewhere to go. */
export function RefLink({ reference, href, className }: { reference: string; href?: string | null; className?: string }) {
  const cls = cn('font-wds-mono text-[13px] leading-[18px] text-[#1F5BAE] underline underline-offset-2 outline-none focus-visible:shadow-wds-ring', className);
  return href ? (
    <Link href={href} className={cls}>
      {reference}
    </Link>
  ) : (
    <span className={cn(cls, 'no-underline text-wds-text-secondary')}>{reference}</span>
  );
}

/** The empty list card (Paper N2b): a bordered card, a 15/20 title and a 13/18 line 260px wide; no icon. */
export function B2Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 border border-wds-border bg-wds-surface px-6 py-14">
      <p className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">{title}</p>
      <p className="w-[260px] max-w-full text-center font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{description}</p>
    </div>
  );
}

/** The small mono caps label over a block ("WHERE IT IS", "ITEMS"). */
export function SectionLabel({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <h2 id={id} className={cn('font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary', className)}>
      {children}
    </h2>
  );
}

// --- Buttons and footer --------------------------------------------------------------------------------------------------------------

const BIG_BUTTON =
  'flex h-12 w-full shrink-0 items-center justify-center rounded-[2px] bg-wds-gradient-primary font-wds-sans text-[15px] font-medium leading-5 text-wds-primary-fg outline-none transition-[filter,transform,box-shadow,opacity] duration-100 focus-visible:shadow-wds-ring enabled:hover:brightness-110 enabled:active:brightness-95 enabled:motion-safe:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-[0.45]';

/** The 48 px primary button of the pack and count screens. Paper draws the disabled one as the same fill at 45 %. */
export const B2PrimaryButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(function B2PrimaryButton({ className, ...props }, ref) {
  return <button ref={ref} type="button" className={cn(BIG_BUTTON, className)} {...props} />;
});

export const B2SecondaryButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(function B2SecondaryButton({ className, ...props }, ref) {
  return <button ref={ref} type="button" className={cn(PHONE_SECONDARY_BUTTON, 'h-12 w-full text-[15px] leading-5', className)} {...props} />;
});

/** The sticky footer: the main button with a line under it ("5 lines left to tick before you go on."). */
export function B2Footer({ children, note, noteId }: { children: React.ReactNode; note?: React.ReactNode; noteId?: string }) {
  return (
    <footer className="flex shrink-0 flex-col gap-2 border-t border-wds-border bg-wds-surface px-5 pb-5 pt-3.5">
      {children}
      {note ? (
        <p id={noteId} aria-live="polite" className="text-center font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
          {note}
        </p>
      ) : null}
    </footer>
  );
}

/** A text button in the caramel link colour ("See every line", "Leave out", "Print"). 44 px target without moving the row. */
export function TextAction({ children, onClick, disabled, className, ...rest }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children' | 'className'>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        '-my-3 flex min-h-11 shrink-0 items-center rounded-wds-sm px-1 font-wds-sans text-[13px] font-medium leading-[18px] text-[var(--wds-primary-btn-start)] outline-none transition-[background-color,opacity] duration-100 hover:bg-wds-caramel-100 focus-visible:shadow-wds-ring active:opacity-70 disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// --- Banner, note, notice -----------------------------------------------------------------------------------------------------------------

const BANNER_TONE = {
  warning: { box: 'border-wds-warning-border bg-wds-warning-bg', title: 'text-wds-warning-fg', dot: 'bg-wds-warning-fg' },
  info: { box: 'border-wds-info-border bg-wds-info-bg', title: 'text-wds-info-fg', dot: 'bg-wds-info-fg' },
  success: { box: 'border-wds-success-border bg-wds-success-bg', title: 'text-wds-success-fg', dot: 'bg-wds-success-fg' },
  error: { box: 'border-wds-error-border bg-wds-error-bg', title: 'text-wds-error-fg', dot: 'bg-wds-error-fg' },
} as const;

/** "Signed and sent", "4 of 5 departments sent", "Cancelled at 3:12 pm": a coloured card with a title and a line. */
export function B2Banner({ tone, title, children, dot = true, compact = false, role = 'status', footnote, smallFootnote = false }: { tone: keyof typeof BANNER_TONE; /** The footnote drawn 12/16 (Paper N1b) instead of 13/18 (Paper D12). */ smallFootnote?: boolean; title: string; children?: React.ReactNode; dot?: boolean; /** The slim card of D6 ("4 of 5 departments sent"): 12/16, a 14/18 title, 13/18 text. */ compact?: boolean; role?: 'status' | 'alert'; footnote?: React.ReactNode }) {
  const t = BANNER_TONE[tone];
  // Paper D6 and D12: a card is 14/16 with gap 6; with a dot the title is 15/20 and the text 14/20, without one the title is
  // 14/20 and the text 13/20 (D12's gap card); the compact card of D6 is 12/16 with gap 3.
  return (
    <section role={role} className={cn('flex flex-col border px-4', compact ? 'gap-[3px] py-3' : 'gap-1.5 py-3.5', t.box)}>
      <h2 className={cn('flex items-center gap-2 font-wds-sans font-semibold', compact ? 'text-[14px] leading-[18px]' : dot ? 'text-[15px] leading-5' : 'text-[14px] leading-5', t.title)}>
        {dot ? <span className={cn('size-2 shrink-0 rounded-full', t.dot)} aria-hidden="true" /> : null}
        {title}
      </h2>
      {children ? <div className={cn('font-wds-sans text-wds-text-ink', compact ? 'text-[13px] leading-[18px]' : dot ? 'text-[14px] leading-5' : 'text-[13px] leading-5')}>{children}</div> : null}
      {footnote ? <div className={cn('font-wds-sans text-wds-text-secondary', smallFootnote ? 'text-[12px] leading-4' : 'text-[13px] leading-[18px]')}>{footnote}</div> : null}
    </section>
  );
}

/** A request that failed, above what the person typed. */
export function B2ErrorNote({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div id={id} role="alert" className="border border-wds-error-border bg-wds-error-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
      {children}
    </div>
  );
}

// --- Fields ------------------------------------------------------------------------------------------------------------------------------

/** "PACKED BY / Store Attendant": a read-only box. */
export function ReadField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary">{label}</span>
      <div className="border border-wds-border-strong bg-wds-neutral-50 px-3 py-2.5 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{value}</div>
    </div>
  );
}

export interface PinFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  error?: string | null;
  disabled?: boolean;
  label?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  /** `paper` is Block 4's box: 10/12 label, 44 high, Geist Mono 18/22 bullets at 0.3em. The default look is unchanged. */
  size?: 'default' | 'paper';
}

/** The four-digit PIN box of D5 and D11: bullets at 18 px, amber edge and a caramel ring when focused, red when the PIN was wrong. */
export function PinField({ id, value, onChange, onSubmit, error, disabled, label = 'Your PIN', inputRef, size = 'default' }: PinFieldProps) {
  const paper = size === 'paper';
  // A wrong PIN clears the box; focus returns to it as soon as it is enabled again (a disabled input cannot take focus).
  React.useEffect(() => {
    if (error && !disabled) document.getElementById(id)?.focus();
  }, [error, disabled, id]);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cn('font-wds-mono uppercase tracking-[0.06em] text-wds-text-secondary', paper ? 'text-[10px] leading-3' : 'text-[11px] leading-[14px]')}>
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        pattern="[0-9]*"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          'w-full border bg-white text-wds-text-ink outline-none transition-shadow duration-100',
          paper ? 'h-11 px-3 font-wds-mono text-[18px] leading-[22px] tracking-[0.3em]' : 'p-3 font-wds-sans text-[18px] leading-5 tracking-[0.5em]',
          // Paper draws the focused edge in #B0610F (`wds-selected-edge`), not the espresso brown the kit used before.
          error ? 'border-wds-error-fg shadow-[0_0_0_3px_var(--wds-error-bg)]' : 'border-wds-border-strong focus:border-wds-selected-edge focus:shadow-[0_0_0_3px_var(--wds-caramel-100)]',
        )}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// --- Tracker (D22 "One tracker, for every role and every width") -------------------------------------------------------------------------

export interface TrackerRow {
  key: string;
  title: string;
  line?: string | null;
  state: 'DONE' | 'CURRENT' | 'TODO' | 'CANCELLED';
}

/** Green circle with a tick = done; ringed circle = current (green, or amber when someone must act); grey circle = to come; red cross = cancelled. */
export function B2Tracker({ rows, heading, currentTone = 'success' }: { rows: readonly TrackerRow[]; heading: string; currentTone?: 'success' | 'warning' }) {
  return (
    <section aria-label={heading} className="flex flex-col">
      <SectionLabel className="pb-3 text-[10px] leading-3">{heading}</SectionLabel>
      <ol className="flex flex-col">
        {rows.map((row, i) => {
          const last = i === rows.length - 1;
          return (
            <li key={row.key} className="flex gap-3" aria-current={row.state === 'CURRENT' ? 'step' : undefined}>
              {/* Paper draws the circles with no line between them (N1, N3a): the rows are 12px apart. */}
              <div className="flex w-5 shrink-0 flex-col items-center">
                <TrackerDot state={row.state} tone={currentTone} />
              </div>
              <div className={cn('flex min-w-0 flex-col gap-px', last ? 'pb-0' : 'pb-3')}>
                <p
                  className={cn(
                    'font-wds-sans text-[14px] leading-[18px]',
                    row.state === 'TODO' && 'text-wds-text-secondary',
                    row.state === 'CANCELLED' && 'text-wds-error-fg',
                    (row.state === 'DONE' || row.state === 'CURRENT') && 'text-wds-text-ink',
                    row.state === 'CURRENT' && 'font-semibold',
                  )}
                >
                  {row.title}
                  <span className="sr-only">
                    {row.state === 'DONE' ? ', done' : row.state === 'CURRENT' ? ', now' : row.state === 'CANCELLED' ? ', cancelled' : ', to come'}
                  </span>
                </p>
                {row.line ? <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{row.line}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function TrackerDot({ state, tone }: { state: TrackerRow['state']; tone: 'success' | 'warning' }) {
  if (state === 'DONE')
    return (
      <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-wds-success-fg">
        <svg width="12" height="12" viewBox="0 0 24 24">
          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  if (state === 'CANCELLED')
    return (
      <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-wds-error-fg">
        <svg width="12" height="12" viewBox="0 0 24 24">
          <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </span>
    );
  if (state === 'CURRENT')
    return (
      <span aria-hidden="true" className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-wds-surface', tone === 'warning' ? 'border-wds-warning-fg' : 'border-wds-success-fg')}>
        <span className={cn('size-2 rounded-full', tone === 'warning' ? 'bg-wds-warning-fg' : 'bg-wds-success-fg')} />
      </span>
    );
  return <span aria-hidden="true" className="size-5 shrink-0 rounded-full border-[1.5px] border-wds-border-strong" />;
}

// --- Items table (N1, N3: ITEM, SENT, COUNTED, GAP) --------------------------------------------------------------------------------------

export interface ItemsTableRow {
  key: string;
  name: string;
  note?: string | null;
  cells: readonly (string | null)[];
  /** The gap column, drawn "0" in a muted mono and "−2" in amber. */
  gap?: string | null;
  flagged?: boolean;
}

export function ItemsTable({ heading, columns, rows, previewCount = 4, labelId }: { heading: string; columns: readonly string[]; rows: readonly ItemsTableRow[]; previewCount?: number; labelId: string }) {
  const [all, setAll] = React.useState(false);
  const shown = all ? rows : rows.slice(0, previewCount);
  const hidden = rows.length - shown.length;
  const hasGap = rows.some((r) => r.gap !== undefined);
  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-2">
      <SectionLabel id={labelId} className="text-[10px] leading-3">{heading}</SectionLabel>
      <div className="border border-wds-border bg-wds-surface">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-wds-border bg-wds-neutral-50">
              <th scope="col" className="px-4 py-2 text-left font-wds-mono text-[10px] font-normal uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
                Item
              </th>
              {columns.map((c, i) => (
                <th key={c} scope="col" className={cn('py-2 text-right font-wds-mono text-[10px] font-normal uppercase leading-3 tracking-[0.06em] text-wds-text-secondary', columns.length === 1 ? 'w-[60px]' : c === 'Sent' ? 'w-12' : 'w-[68px]', i === columns.length - 1 && !hasGap ? 'pr-4' : '')}>
                  {c}
                </th>
              ))}
              {hasGap ? (
                <th scope="col" className="w-11 py-2 pr-4 text-right font-wds-mono text-[10px] font-normal uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
                  Gap
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.key} className={cn('border-b border-wds-border last:border-b-0', row.flagged && 'bg-wds-warning-bg')}>
                <th scope="row" className="px-4 py-[11px] text-left align-middle font-wds-sans text-[14px] font-normal leading-[18px] text-wds-text-ink">
                  {row.name}
                  {row.note ? <span className="mt-0.5 block font-wds-sans text-[12px] leading-4 text-wds-warning-fg">{row.note}</span> : null}
                </th>
                {row.cells.map((cell, i) => (
                  <td key={i} className={cn('py-[11px] text-right align-middle font-wds-sans text-[14px] leading-[18px] text-wds-text-ink', i === row.cells.length - 1 && !hasGap ? 'pr-4' : '')}>
                    {cell ?? '–'}
                  </td>
                ))}
                {hasGap ? (
                  <td className={cn('py-[11px] pr-4 text-right align-middle text-[13px] leading-[18px]', row.flagged ? 'font-wds-sans font-medium text-wds-warning-fg' : 'font-wds-mono text-wds-text-faint')}>{row.gap ?? '–'}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > previewCount ? (
          <div className="border-t border-wds-border px-4 py-0.5">
            <TextAction onClick={() => setAll((v) => !v)} aria-expanded={all} className="-my-0 text-[13px]">
              {all ? 'Show fewer lines' : `Show the other ${hidden} ${hidden === 1 ? 'line' : 'lines'}`}
            </TextAction>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// --- Pager (the Block 1 G1 shape) --------------------------------------------------------------------------------------------------------------

/** "Showing 1 to 5 of 31" with ‹ 1 2 3 ›. The current page is dark; an arrow that cannot be used is grey. */
export function PagerBar({ page, pageSize, total, shown, onPage, noun }: { page: number; pageSize: number; total: number; shown: number; onPage: (p: number) => void; noun: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const numbers = Array.from({ length: Math.min(pages, 5) }, (_, i) => Math.min(Math.max(1, page - 2), Math.max(1, pages - 4)) + i);
  const box =
    'flex size-8 shrink-0 items-center justify-center border font-wds-sans text-[12px] leading-4 outline-none transition-colors duration-100 focus-visible:shadow-wds-ring enabled:hover:bg-wds-neutral-100 enabled:active:bg-wds-neutral-200 disabled:cursor-not-allowed';
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pb-5 pt-3">
      <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary" aria-live="polite">
        Showing {first} to {first + shown - 1} of {total} {noun}
      </p>
      {pages > 1 ? (
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className={cn(box, 'border-wds-border-strong bg-wds-surface text-wds-text-ink disabled:text-wds-text-faint')}>
            ‹
          </button>
          {numbers.map((n) => (
            <button key={n} type="button" aria-label={`Page ${n}`} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)} className={cn(box, n === page ? 'border-wds-text-ink bg-wds-text-ink text-wds-surface' : 'border-wds-border-strong bg-wds-surface text-wds-text-ink')}>
              {n}
            </button>
          ))}
          <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className={cn(box, 'border-wds-border-strong bg-wds-surface text-wds-text-ink disabled:text-wds-text-faint')}>
            ›
          </button>
        </div>
      ) : null}
    </nav>
  );
}

// --- Skeletons ----------------------------------------------------------------------------------------------------------------------------

/** Rows that mirror a list of cards: used while a list loads. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="border border-wds-border bg-wds-surface" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center justify-between gap-3 border-b border-wds-border px-4 py-3.5 last:border-b-0">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-20" />
        </li>
      ))}
    </ul>
  );
}
