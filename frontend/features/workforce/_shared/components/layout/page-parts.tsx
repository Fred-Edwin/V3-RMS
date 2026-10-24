'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, PRESSED, onHover } from '../../lib/style/interaction';
import { nextInGroup } from '../../lib/data/roving';

/**
 * Page furniture shared by every Workforce screen.
 *
 * - `PageHeader`: the title (24 px, 600; `size="lg"` is the 28 px Rules heading),
 *   a grey line under it and the actions at the right (Paper 16DF-0, 1KEL-0, 18AS-0).
 * - `PeriodStepper`: "‹ Mon 12 to Sun 18 October 2026 ›" (Paper 16DH-0).
 * - `UnderlineTabs`: tabs with a 2 px ink underline on the chosen one (Paper 1KEU-0).
 * - `SegmentedControl`: a row of buttons, the chosen one filled ink (Paper 1D6Z-0).
 *
 * Every word comes in as a prop; none of these holds a role name.
 */

export function PageHeader({
  title,
  subtitle,
  actions,
  size = 'md',
  className,
}: {
  /** Words; a node only where a tag sits beside the title (the Today board on a past day). */
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Buttons at the right. Pass only the ones the viewer may use; the brown one comes last. */
  actions?: React.ReactNode;
  size?: 'md' | 'lg';
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1
          className={cn(
            'm-0 font-wds-sans font-semibold tracking-[-0.02em] text-wds-text-ink',
            size === 'lg' ? 'text-[28px] leading-[34px]' : 'text-[24px] leading-[30px]'
          )}
        >
          {title}
        </h1>
        {subtitle ? (
          <div className={cn('m-0 font-wds-sans text-wds-text-secondary', size === 'lg' ? 'text-[13px] leading-[18px]' : 'text-[14px] leading-[18px]')}>{subtitle}</div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

const arrowClass = cn(
  'flex h-7 w-7 items-center justify-center font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary',
  MOTION,
  FOCUS_RING,
  PRESSED,
  onHover('text-wds-text-ink'),
  'disabled:pointer-events-none disabled:opacity-40'
);

export function PeriodStepper({
  label,
  onPrevious,
  onNext,
  previousLabel = 'Previous period',
  nextLabel = 'Next period',
  previousDisabled = false,
  nextDisabled = false,
  className,
}: {
  /** "Mon 12 to Sun 18 October 2026". */
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  previousLabel?: string;
  nextLabel?: string;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <button type="button" aria-label={previousLabel} onClick={onPrevious} disabled={previousDisabled} className={arrowClass}>
        <span aria-hidden>‹</span>
      </button>
      <span aria-live="polite" className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">
        {label}
      </span>
      <button type="button" aria-label={nextLabel} onClick={onNext} disabled={nextDisabled} className={arrowClass}>
        <span aria-hidden>›</span>
      </button>
    </div>
  );
}

export interface TabItem {
  value: string;
  label: string;
  /** A small count after the label (3 waiting). */
  count?: number;
  disabled?: boolean;
}

export function UnderlineTabs({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: readonly TabItem[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the group ("Rule groups"). */
  label: string;
  className?: string;
}) {
  const refs = React.useRef(new Map<string, HTMLButtonElement>());
  const values = items.map((i) => i.value);
  const disabled = new Set(items.filter((i) => i.disabled).map((i) => i.value));
  return (
    <div role="tablist" aria-label={label} className={cn('flex overflow-x-auto border-b border-wds-border', className)}>
      {items.map((item) => {
        const chosen = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              if (el) refs.current.set(item.value, el);
              else refs.current.delete(item.value);
            }}
            type="button"
            role="tab"
            aria-selected={chosen}
            tabIndex={chosen ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => {
              const next = nextInGroup(e.key, values, value, disabled);
              if (next === null) return;
              e.preventDefault();
              onChange(next);
              refs.current.get(next)?.focus();
            }}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-[9px] font-wds-sans text-[13px] leading-4',
              MOTION,
              FOCUS_RING,
              'disabled:pointer-events-none disabled:opacity-60',
              chosen ? 'border-wds-text-ink font-semibold text-wds-text-ink' : cn('border-transparent text-wds-text-secondary', onHover('text-wds-text-ink'))
            )}
          >
            {item.label}
            {item.count !== undefined ? <span className="font-wds-mono text-[11px] text-wds-text-secondary">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export interface SegmentItem {
  value: string;
  label: string;
  /** Cannot be chosen (the screen shows the reason in words beside the control). */
  disabled?: boolean;
}

export function SegmentedControl({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: readonly SegmentItem[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  const refs = React.useRef(new Map<string, HTMLButtonElement>());
  const enabledValues = items.filter((i) => !i.disabled).map((i) => i.value);
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex', className)}>
      {items.map((item) => {
        const chosen = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              if (el) refs.current.set(item.value, el);
              else refs.current.delete(item.value);
            }}
            type="button"
            role="radio"
            aria-checked={chosen}
            aria-disabled={item.disabled || undefined}
            tabIndex={chosen ? 0 : -1}
            onClick={() => (item.disabled ? undefined : onChange(item.value))}
            onKeyDown={(e) => {
              const next = nextInGroup(e.key, enabledValues, value);
              if (next === null) return;
              e.preventDefault();
              onChange(next);
              refs.current.get(next)?.focus();
            }}
            className={cn(
              'px-3.5 font-wds-sans text-[13px] leading-4',
              MOTION,
              FOCUS_RING,
              item.disabled && 'cursor-not-allowed opacity-60',
              chosen
                ? 'bg-wds-text-ink py-2 text-wds-primary-fg'
                : cn('border border-wds-border-strong bg-wds-surface py-[7px] text-wds-text-ink', onHover('bg-wds-neutral-50'))
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
