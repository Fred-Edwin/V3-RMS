'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover } from '../lib/interaction';

/**
 * List and detail layout (Interaction spec rule 05; owner decision 4 Oct 2026):
 * two columns, the list on the left and the chosen row's detail on the right.
 * The chosen row carries a 3 px caramel bar. On a phone the two become one
 * column: the list, then the detail replaces it (the screen passes `showDetail`).
 *
 * The layout holds no data and no role logic. A screen supplies the list, the
 * detail and which one is showing on a phone.
 */
export function ListDetailLayout({
  list,
  detail,
  showDetail = false,
  listWidth = 380,
  className,
}: {
  list: React.ReactNode;
  detail: React.ReactNode;
  /** Phone only: true shows the detail column and hides the list. */
  showDetail?: boolean;
  /** Width of the list column on desktop, in px. */
  listWidth?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-0 w-full border border-wds-border bg-wds-surface', className)}>
      <section
        aria-label="List"
        className={cn('min-w-0 shrink-0 border-r border-wds-border max-md:w-full max-md:border-r-0 md:w-[var(--list-w)]', showDetail && 'max-md:hidden')}
        style={{ '--list-w': `${listWidth}px` } as React.CSSProperties}
      >
        {list}
      </section>
      <section aria-label="Detail" className={cn('min-w-0 flex-1', !showDetail && 'max-md:hidden')}>
        {detail}
      </section>
    </div>
  );
}

/**
 * One row of the list. The chosen row gets the caramel bar and `aria-current`.
 * It is a button so the keyboard works: Tab to reach it, Enter or Space to choose.
 */
export function ListRow({
  selected = false,
  onSelect,
  children,
  className,
}: {
  selected?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'relative flex w-full items-center gap-3 border-b border-wds-border px-4 py-3 text-left',
        MOTION,
        FOCUS_RING,
        'focus-visible:z-10',
        selected ? 'bg-wds-neutral-50' : onHover('bg-wds-neutral-50'),
        className
      )}
    >
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0 w-[3px] bg-wds-caramel-600 transition-opacity duration-150 motion-reduce:transition-none', selected ? 'opacity-100' : 'opacity-0')}
      />
      {children}
    </button>
  );
}
