import * as React from 'react';

import { cn } from '@/lib/cn';
import type { OrderStatus } from '../types';

/** Small pieces shared by the Purchasing screens. Values are read from the Paper page "Inventory · Purchasing". */

/** Table header cell: 10px mono, 0.06em, ink (Paper `3T-0`, `XW-0`). Tables here use the no-fill header with an ink rule. */
export const thClass = 'font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-neutral-950 uppercase';

/** Two-option segmented toggle (Paper `3L-0`): 30px, border-strong, the selected side on espresso-50. */
export function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="ml-auto flex shrink-0 overflow-hidden rounded-[2px] border border-wds-border-strong">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex h-[30px] items-center px-3 font-wds-sans text-wds-body-sm outline-none transition-colors focus-visible:shadow-wds-ring',
              i > 0 && 'border-l border-wds-border-strong',
              on ? 'bg-wds-espresso-50 font-medium text-wds-neutral-950' : 'bg-wds-surface text-wds-text-secondary hover:bg-wds-neutral-50'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const DOT_ORDER: Array<(s: OrderStatus) => boolean> = [
  (s) => s !== 'DRAFT',
  (s) => ['APPROVED', 'SENT', 'DELIVERED', 'INVOICED', 'CLOSED'].includes(s),
  (s) => ['SENT', 'DELIVERED', 'INVOICED', 'CLOSED'].includes(s),
  (s) => ['DELIVERED', 'INVOICED', 'CLOSED'].includes(s),
  (s) => ['INVOICED', 'CLOSED'].includes(s),
  (s) => s === 'CLOSED',
];

/** Mini stage tracker (Paper `YB-0`): six 8px dots joined by 2px lines; done = success green, the rest neutral. */
export function StageDots({ status, label, tone = 'muted' }: { status: OrderStatus; label: string; tone?: 'muted' | 'error' }) {
  return (
    <div className="flex w-[112px] shrink-0 flex-col gap-[5px]">
      <div className="flex items-center" aria-hidden>
        {DOT_ORDER.map((done, i) => {
          const on = status !== 'CANCELLED' && done(status);
          const next = on && i < DOT_ORDER.length - 1 && (DOT_ORDER[i + 1] as (s: OrderStatus) => boolean)(status);
          // The first step not done yet is the current one: an amber ring (Paper `16`, `19`).
          const current = !on && status !== 'CANCELLED' && status !== 'CLOSED' && DOT_ORDER.slice(0, i).every((d) => d(status));
          return (
            <React.Fragment key={i}>
              <span className={cn('size-2 shrink-0 rounded-full', on ? 'bg-wds-success-fg' : current ? 'border-[1.5px] border-wds-primary bg-white' : 'bg-wds-neutral-300')} />
              {i < DOT_ORDER.length - 1 ? <span className={cn('h-0.5 w-2 shrink-0', next ? 'bg-wds-success-fg' : 'bg-wds-neutral-300')} /> : null}
            </React.Fragment>
          );
        })}
      </div>
      <span className={cn('font-wds-sans text-[11px] leading-[14px]', tone === 'error' ? 'text-wds-error-fg' : 'text-wds-text-secondary')}>{label}</span>
    </div>
  );
}

/** A coloured dot with a word, as in the Status and Expected columns. */
export function DotLabel({ tone, children, className }: { tone: 'warning' | 'error' | 'success' | 'muted'; children: React.ReactNode; className?: string }) {
  const dot = { warning: 'bg-wds-warning-fg', error: 'bg-wds-error-fg', success: 'bg-wds-success-fg', muted: 'bg-wds-neutral-400' }[tone];
  const text = { warning: 'text-wds-warning-fg', error: 'text-wds-error-fg', success: 'text-wds-success-fg', muted: 'text-wds-text-secondary' }[tone];
  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', dot)} aria-hidden />
      <span className={cn('font-wds-sans text-wds-caption', text)}>{children}</span>
    </span>
  );
}

/** The PIN box inside a drawer (Paper `37`, `38`): four dots, the message under it when the PIN is wrong. The demo PIN is hinted. */
export function InlinePin({ value, onChange, error, id, className }: { value: string; onChange: (v: string) => void; error?: string | null; id: string; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        aria-invalid={error ? true : undefined}
        className={cn('h-8 w-[130px] border bg-white px-2.5 font-wds-mono text-wds-body-sm tracking-[0.3em] text-wds-neutral-950 outline-none focus:shadow-wds-ring', error ? 'border-wds-error-fg' : 'border-wds-border-strong')}
      />
      {error ? (
        <p role="alert" className="font-wds-sans text-wds-caption text-wds-error-fg">
          {error}
        </p>
      ) : (
        <p className="font-wds-sans text-[11px] text-wds-text-faint">Demo: the PIN is 1234.</p>
      )}
    </div>
  );
}

/** Label above a field in a drawer (Paper: 10px mono caps). */
export function FieldLabel({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary uppercase', className)}>
      {children}
    </label>
  );
}
