import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Milestone Six mobile sub-screen header — back chevron, title + subtitle
 * and an optional trailing text action on one row, on `sidebar-top`
 * (`1ACM-0` Log waste, `1BPY-0` / `1FDY-0` Stock ledger). Differs from the
 * Milestone One `MobileTaskHeader` (which stacks back/Cancel above the
 * title) — these artboards draw a single row, so they get their own header
 * rather than bending that one.
 */
export function StockMobileHeader({
  title,
  subtitle,
  onBack,
  trailingLabel,
  onTrailing,
  className,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  trailingLabel?: string;
  onTrailing?: () => void;
  className?: string;
}) {
  return (
    <header className={cn('flex items-center gap-3 bg-wds-sidebar-top px-4 pb-4 pt-3', className)}>
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="-m-2 flex size-9 shrink-0 items-center justify-center rounded-wds-sm outline-none transition-transform duration-150 ease-out focus-visible:shadow-wds-ring motion-safe:active:scale-[0.92]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <path d="M15 18l-6-6 6-6" fill="none" stroke="var(--wds-sidebar-fg-active)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="flex min-w-0 grow basis-0 flex-col gap-0.5">
        <h1 className="truncate font-wds-sans text-[17px]/[22px] font-semibold text-wds-sidebar-fg-active">{title}</h1>
        <p className="line-clamp-2 font-wds-sans text-wds-caption text-wds-sidebar-fg-item">{subtitle}</p>
      </div>
      {trailingLabel ? (
        <button
          type="button"
          onClick={onTrailing}
          className="-m-2 shrink-0 rounded-wds-sm p-2 font-wds-sans text-wds-body-sm text-wds-sidebar-fg-item outline-none transition-colors hover:text-wds-sidebar-fg-active focus-visible:shadow-wds-ring"
        >
          {trailingLabel}
        </button>
      ) : null}
    </header>
  );
}
