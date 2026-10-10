'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { Chip, PinField, SectionLabel } from '../../../_shared/components/block2-phone-parts';
import type { ChipTone } from '../../../_shared/lib/block2-words';
import { PHONE_REFUSAL_COPY } from '../lib/phone-copy';

/**
 * Parts the Branch day phone screens share (Paper B0 to B4). Values are from the spec `branch-day-paper-spec.md` §1.3: a mono label
 * 10/12, a count row 60 high, a 64 × 40 count box, a status card, a receipt card with a 2 px ink top, a 44 high PIN box.
 */

const CARAMEL_EDGE = 'shadow-[inset_3px_0_0_0_var(--wds-primary-btn-start)]';

/** The mono caps label over a block ("BARISTA TODAY", "YOU COUNTED", "SIGNED BY"). */
export function MonoLabel({ children, id, className }: { children: React.ReactNode; id?: string; className?: string }) {
  return (
    <SectionLabel id={id} className={cn('text-[10px] leading-3', className)}>
      {children}
    </SectionLabel>
  );
}

/** A chip drawn 24 high (padding 3 9), as the receipt cards draw it. */
export function CardChip({ tone, text }: { tone: ChipTone; text: string }) {
  return <Chip spec={{ tone, text }} className="px-[9px] py-[3px]" />;
}

const Check = ({ size = 18, stroke = 2.2 }: { size?: number; stroke?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#FFFFFF" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The green disc with a white tick (done card, success note, tracker). */
export function DoneDisc({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('flex shrink-0 items-center justify-center rounded-full bg-wds-success-fg', className)} style={{ width: size, height: size }}>
      <Check size={size * 0.66} stroke={2.4} />
    </span>
  );
}

/** A 16 × 16 ring: a step still to come (muted) or the one to do now (amber). */
export function RingMarker({ active = false, className }: { active?: boolean; className?: string }) {
  return <span aria-hidden="true" className={cn('size-4 shrink-0 rounded-full border-[1.5px]', active ? 'border-[var(--wds-primary-btn-start)]' : 'border-wds-border-strong', className)} />;
}

/** B0: a step of the day. `done` is a green tick, `active` the one to do now (caramel fill and edge), `muted` a step that has not come. */
export function StatusCard({ state, title, sub, children }: { state: 'done' | 'active' | 'muted'; title: string; sub: string; children?: React.ReactNode }) {
  return (
    <li className={cn('flex items-start gap-3 border px-4 py-3.5', state === 'active' ? cn('border-[var(--wds-primary-btn-start)] bg-wds-caramel-100', CARAMEL_EDGE) : 'border-wds-border-strong bg-wds-surface')}>
      {state === 'done' ? <DoneDisc className="mt-px" /> : <RingMarker active={state === 'active'} className="mt-0.5" />}
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className={cn('font-wds-sans text-[15px] leading-5 text-wds-text-ink', state === 'active' ? 'font-semibold' : 'font-medium')}>
          {title}
          <span className="sr-only">{state === 'done' ? ', done' : state === 'active' ? ', to do now' : ', not yet'}</span>
        </p>
        <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{sub}</p>
        {children}
      </div>
    </li>
  );
}

/** B2, B3b: the receipt-style card, a 2 px ink rule on top. */
export function ReceiptCard({ label, title, chip, children }: { label: string; title: string; chip: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="border-x border-b border-t-2 border-wds-border-strong border-t-wds-text-ink bg-wds-surface">
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-3.5">
        <div className="flex flex-col gap-0.5">
          <MonoLabel>{label}</MonoLabel>
          <p className="font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink">{title}</p>
        </div>
        {chip}
      </div>
      {children}
    </section>
  );
}

export function ReceiptSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-0.5 border-t border-wds-border px-4 py-2.5', className)}>{children}</div>;
}

/** The read-only "SIGNED BY" field: H40, 14/18 on #F6F5F3. */
export function SignedByField({ value }: { value: string }) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <MonoLabel id={id}>Signed by</MonoLabel>
      <div aria-labelledby={id} className="flex h-10 items-center border border-wds-border bg-wds-neutral-50 px-3 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">
        {value}
      </div>
    </div>
  );
}

/** Signed by + PIN, the two fields under every receipt. */
export function SignFields({ signedBy, sign }: { signedBy: string; sign: SignState }) {
  const pinRef = React.useRef<HTMLInputElement>(null);
  // Paper draws the PIN box focused when the screen opens: the person types four digits and taps.
  React.useEffect(() => {
    pinRef.current?.focus();
  }, []);
  return (
    <>
      <SignedByField value={signedBy} />
      <PinField id="branch-day-pin" inputRef={pinRef} size="paper" value={sign.pin} onChange={sign.setPin} onSubmit={sign.submit} error={sign.pinError} disabled={sign.saving} />
      {sign.problem ? (
        <p role="alert" className="border border-wds-error-border bg-wds-error-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {sign.problem}
        </p>
      ) : null}
    </>
  );
}

export interface SignState {
  pin: string;
  setPin: (pin: string) => void;
  pinError: string | null;
  problem: string | null;
  saving: boolean;
  ready: boolean;
  submit: () => void;
}

// --- The count list ------------------------------------------------------------------------------------------------------

/** One row of a list of items: name and hint on the left, the figure on the right. 60 high (61 with a 40 box). */
export function CountRow({ name, hint, children, className, htmlFor }: { name: string; hint: string; children: React.ReactNode; className?: string; htmlFor?: string }) {
  const Tag = htmlFor ? 'label' : 'div';
  return (
    <Tag htmlFor={htmlFor} className={cn('flex items-center gap-3 border-b border-wds-border px-5 py-2.5', className)}>
      <span className="flex min-w-0 grow flex-col gap-px">
        <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{name}</span>
        <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{hint}</span>
      </span>
      {children}
    </Tag>
  );
}

/** B1: last night's figure, read only, Geist Mono 16/20. */
export function LastNightFigure({ value }: { value: string }) {
  return <span className="font-wds-mono text-[16px] leading-5 text-wds-text-ink">{value}</span>;
}

export interface CountBoxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * The 64 × 40 box a count is typed in (Paper B3, B3c). Empty shows "–" and means not counted; zero must be typed. The whole row is a
 * label, so the touch target is the row (61 high), not just the box.
 */
export const CountBox = React.forwardRef<HTMLInputElement, CountBoxProps>(function CountBox({ value, onChange, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      enterKeyHint="next"
      placeholder="–"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-10 w-16 shrink-0 border border-wds-border-strong bg-white text-center font-wds-sans text-[16px] font-medium leading-5 text-wds-text-ink outline-none transition-shadow duration-100 placeholder:font-normal placeholder:text-[#8D8982] focus:border-[var(--wds-primary-btn-start)] focus:shadow-[0_0_0_3px_var(--wds-caramel-100)]',
        className,
      )}
      {...rest}
    />
  );
});

/** The row highlight of the box being typed in: caramel fill and a 3 px left edge. */
export const FOCUS_ROW = cn('focus-within:bg-wds-caramel-100', 'focus-within:shadow-[inset_3px_0_0_0_var(--wds-primary-btn-start)]');

/** B3: "5 of 8 counted" over a 4 px bar. Sits between the header and the list, with an ink rule under it. */
export function ProgressStrip({ filled, total, percent }: { filled: number; total: number; percent: number }) {
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-wds-text-ink bg-wds-surface px-5 pb-3 pt-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p aria-live="polite" className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">
          {filled} of {total} counted
        </p>
        <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Count what is on the shelves</p>
      </div>
      <div role="progressbar" aria-label="Items counted" aria-valuemin={0} aria-valuemax={total} aria-valuenow={filled} className="h-1 w-full bg-wds-neutral-100">
        <div className="h-full bg-wds-text-ink" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

// --- Tracker (B4) ---------------------------------------------------------------------------------------------------------

export interface PhoneTrackerRow {
  key: string;
  text: string;
  state: 'done' | 'latest' | 'todo';
}

/** B4: four rows, 16 px discs, no heading. The latest done row is weight 500. */
export function PhoneTracker({ rows, label }: { rows: readonly PhoneTrackerRow[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-2.5" aria-current={row.state === 'latest' ? 'step' : undefined}>
          {row.state === 'todo' ? <RingMarker /> : <DoneDisc size={16} />}
          <span className={cn('font-wds-sans text-[14px] leading-[18px]', row.state === 'todo' ? 'text-wds-text-secondary' : 'text-wds-text-ink', row.state === 'latest' && 'font-medium')}>
            {row.text}
            <span className="sr-only">{row.state === 'todo' ? ', to come' : ', done'}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

// --- Loading, empty, error --------------------------------------------------------------------------------------------------

/** A skeleton that mirrors a list of count rows, with the loading line announced. */
export function RowsSkeleton({ rows = 8, text }: { rows?: number; text: string }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col bg-wds-surface" aria-busy="true">
      <LoadingAnnouncer text={text} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-wds-border px-5 py-2.5" aria-hidden="true">
          <div className="flex grow flex-col gap-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="h-10 w-16" />
        </div>
      ))}
    </main>
  );
}

/** A skeleton that mirrors the Day cards. */
export function CardsSkeleton({ text }: { text: string }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3.5 bg-wds-surface p-5" aria-busy="true">
      <LoadingAnnouncer text={text} />
      <Skeleton className="h-3 w-28" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[70px] w-full" />
      ))}
    </main>
  );
}

/** Empty, error with Retry, or permission: the States kit's phone panel inside the white body. */
export function BodyState({ kind, text, onRetry, inMain = false }: { kind: 'empty' | 'error' | 'permission'; text: string; onRetry?: () => void; /** The screen already has its own `main` (the past-days screens). */ inMain?: boolean }) {
  const Wrap = inMain ? 'div' : 'main';
  // A department added after the day began is not a failure: nothing will change on Retry until tomorrow, so it reads as a plain note.
  const notAFailure = kind === 'error' && text === PHONE_REFUSAL_COPY.noDepartment;
  return (
    <Wrap className="flex min-h-0 flex-1 flex-col justify-center bg-wds-surface px-5 py-6">
      <ScwStatePanel kind={notAFailure ? 'empty' : kind} text={text} phone onRetry={onRetry} />
    </Wrap>
  );
}
