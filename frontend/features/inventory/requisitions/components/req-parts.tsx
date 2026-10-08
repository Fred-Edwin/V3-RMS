'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import type { SectionStatus } from '../_shared/types/requisitions-contract';
import type { Chip } from '../_shared/lib/requisitions-words';

/** A document number: Geist Mono, #1F5BAE, underlined where it is a link (owner rule for every document number). */
export function DocLink({ href, children, className }: { href?: string; children: React.ReactNode; className?: string }) {
  const style = 'whitespace-nowrap font-wds-mono text-[14px] leading-[18px] text-[#1F5BAE] underline underline-offset-2';
  if (!href) return <span className={cn(style, 'no-underline', className)}>{children}</span>;
  return (
    <Link href={href} className={cn(style, 'outline-none focus-visible:shadow-wds-ring', className)}>
      {children}
    </Link>
  );
}

export interface TabDef<T extends string> {
  key: T;
  label: string;
  count?: number;
  /** The dark badge: this tab holds what waits for the caller. */
  dark?: boolean;
}

/** The underlined tabs of Paper steps 7 and 7b, with arrow-key movement. A tab with `dark` wears the dark count badge. */
export function ReqTabs<T extends string>({ tabs, active, onChange, label }: { tabs: readonly TabDef<T>[]; active: T; onChange: (key: T) => void; label: string }) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: React.KeyboardEvent, index: number): void => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + tabs.length) % tabs.length;
    refs.current[next]?.focus();
    const target = tabs[next];
    if (target) onChange(target.key);
  };
  return (
    <div role="tablist" aria-label={label} className="flex shrink-0 flex-wrap gap-x-7 border-b border-wds-border">
      {tabs.map((tab, index) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`req-tab-${tab.key}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-1 pb-2.5 pt-1 font-wds-sans text-[14px] leading-[18px] transition-colors duration-150 focus-visible:outline-none focus-visible:shadow-[0_2px_0_0_var(--wds-selected-edge)]',
              selected ? 'border-wds-selected-edge font-semibold text-wds-text-ink' : 'border-transparent text-wds-text-secondary hover:text-wds-text-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              tab.dark && tab.count > 0 ? (
                <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center bg-wds-sidebar-badge-bg px-1 font-wds-mono text-[11px] font-semibold text-wds-sidebar-badge-fg">{tab.count}</span>
              ) : (
                <span className="pt-0.5 font-wds-mono text-[11px] leading-[14px] text-wds-text-faint">{tab.count}</span>
              )
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** One green square per section that is in, hollow for the others (Paper step 7). */
export function SectionSquares({ sections }: { sections: readonly { departmentName: string; status: SectionStatus }[] }) {
  return (
    <span className="inline-flex gap-[3px]" aria-hidden>
      {sections.map((s) => {
        const done = s.status === 'SUBMITTED' || s.status === 'SKIPPED';
        return <span key={s.departmentName} className={cn('size-2', done ? 'bg-wds-success-fg' : 'border border-wds-border-strong bg-wds-surface')} />;
      })}
    </span>
  );
}

const CHIP_TONE: Record<Chip['tone'], string> = {
  warning: 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg',
  success: 'border-wds-success-border bg-wds-success-bg text-wds-success-fg',
  info: 'border-wds-info-border bg-wds-info-bg text-wds-info-fg',
  error: 'border-wds-error-border bg-wds-error-bg text-wds-error-fg',
  neutral: 'border-wds-border-strong bg-wds-neutral-100 text-wds-text-secondary',
};
const CHIP_DOT: Record<Chip['tone'], string> = {
  warning: 'bg-wds-warning-fg',
  success: 'bg-wds-success-fg',
  info: 'bg-wds-info-fg',
  error: 'bg-wds-error-fg',
  neutral: 'border border-wds-text-secondary bg-transparent',
};

/** The status chip: a dot and a word in a bordered box. */
export function StatusChip({ chip }: { chip: Chip }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap border px-2.5 font-wds-sans text-[13px] leading-4', CHIP_TONE[chip.tone])}>
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', CHIP_DOT[chip.tone])} />
      {chip.text}
    </span>
  );
}

/** The red "Urgent" tag beside a document number. */
export function UrgentTag() {
  return (
    <span className="inline-flex h-[22px] items-center gap-1.5 border border-wds-error-border bg-wds-error-bg px-2 font-wds-sans text-[13px] leading-4 text-wds-error-fg">
      <span aria-hidden className="size-1.5 rounded-full bg-wds-error-fg" />
      Urgent
    </span>
  );
}

/** "YOUR PIN": one masked field of four digits (Paper steps 11, 16, 19). `invalid` marks it after a rejected PIN. */
export const PinField = React.forwardRef<HTMLInputElement, { value: string; onChange: (pin: string) => void; invalid?: boolean; onSubmit?: () => void; id?: string }>(
  ({ value, onChange, invalid, onSubmit, id = 'req-pin' }, ref) => (
    <div className="flex flex-col gap-1.5">
      <MonoLabel htmlFor={id}>Your PIN</MonoLabel>
      <input
        ref={ref}
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 4))}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && value.length === 4) onSubmit?.();
        }}
        className={cn(
          'h-12 w-[200px] border bg-wds-surface px-4 font-wds-mono text-[20px] tracking-[0.4em] text-wds-text-ink outline-none',
          invalid ? 'border-wds-error-fg' : 'border-wds-border-strong focus:border-wds-primary focus:shadow-wds-ring',
        )}
      />
    </div>
  ),
);
PinField.displayName = 'PinField';

/** A small mono label above a value ("NEXT STEP", "YOUR PIN"). */
export function MonoLabel({ children, className, htmlFor }: { children: React.ReactNode; className?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary', className)}>
      {children}
    </label>
  );
}
