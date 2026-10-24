'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { DISABLED, FOCUS_RING, MOTION, PRESSED, onHover } from '../../lib/style/interaction';

/**
 * Filter chip with a count — "Needs finishing 3". Paper: Employees list R2T-0.
 * 32 px tall, 13 px label, 11 px mono count. The chosen chip is ink-filled; a
 * chip that points at something needing a look wears the warning colours.
 * It is a toggle button (`aria-pressed`), so a screen reader hears the state.
 */
export interface FilterChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  count?: number;
  selected?: boolean;
  /** `attention` = the warning chip (rows that need a look). */
  tone?: 'default' | 'attention';
  /** A 6 px square after the count: this group has people who need a look (Paper Q50-0; amber, or red for the worst). */
  marker?: 'warning' | 'error';
  /** Shown as the tooltip and read out when the chip is disabled. */
  disabledReason?: string;
}

export const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(function FilterChip(
  { label, count, selected = false, tone = 'default', marker, disabledReason, disabled, className, ...props },
  ref
) {
  const attention = tone === 'attention';
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className={cn(
        'inline-flex h-8 items-center gap-2 border px-3 font-wds-sans text-[13px] leading-4',
        MOTION,
        FOCUS_RING,
        PRESSED,
        DISABLED,
        selected
          ? 'border-wds-text-ink bg-wds-text-ink text-wds-canvas'
          : attention
            ? cn('border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg', onHover('border-wds-warning-fg'))
            : cn('border-wds-border-strong bg-transparent text-wds-text-ink', onHover('bg-wds-neutral-50')),
        className
      )}
      {...props}
    >
      <span>{label}</span>
      {count !== undefined ? (
        <span
          className={cn(
            'font-wds-mono text-[11px] leading-[14px]',
            selected ? 'text-wds-neutral-400' : attention ? 'text-wds-warning-fg' : 'text-wds-text-secondary'
          )}
        >
          {count}
        </span>
      ) : null}
      {marker ? (
        <>
          <span aria-hidden className={cn('size-1.5 shrink-0', marker === 'error' ? 'bg-wds-error-fg' : 'bg-wds-warning-fg')} />
          <span className="sr-only">{marker === 'error' ? 'Someone here is not in' : 'Someone here is late'}</span>
        </>
      ) : null}
      {disabled && disabledReason ? <span className="sr-only">{disabledReason}</span> : null}
    </button>
  );
});

/**
 * The bar around them (UI_BUILD_RULES 4a): search first, then chips, with the
 * column dropdowns at the right. Layout only. A real table feeds this from
 * `components/ui2/data-table` (`table-toolbar`), which owns the URL state.
 */
export function FilterBar({
  search,
  chips,
  trailing,
  className,
}: {
  search?: React.ReactNode;
  chips?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {search}
      {chips ? (
        <div role="group" aria-label="Filter" className="flex flex-wrap items-center gap-2">
          {chips}
        </div>
      ) : null}
      {trailing ? <div className="ml-auto flex flex-wrap items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
