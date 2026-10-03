import * as React from 'react';

import { Button } from '@/components/ui2/button';

export interface UnsavedBarProps {
  changeCount: number;
  /** Levels that are not a number and must be fixed before Review. */
  invalidCount: number;
  onDiscard: () => void;
  onReview: () => void;
}

/**
 * "N changes not saved" — Paper step 11's bar. Nothing is sent until Review, then Save. It sits under the list
 * (not inside the scrolling area) so it stays in view however long the list is.
 */
export function UnsavedBar({ changeCount, invalidCount, onDiscard, onReview }: UnsavedBarProps) {
  const blocked = invalidCount > 0 || changeCount === 0;
  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      className="flex shrink-0 items-center justify-between border border-wds-border-strong bg-white px-4 py-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-150"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden className="size-2 shrink-0 rounded-[4px] bg-wds-selected-edge" />
        <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink" aria-live="polite">
          {changeCount === 0 ? 'A level is not a number' : `${changeCount} ${changeCount === 1 ? 'change' : 'changes'} not saved`}
        </span>
        {invalidCount > 0 ? (
          <span className="font-wds-sans text-[13px] leading-4 text-wds-error-fg">
            {invalidCount} {invalidCount === 1 ? 'level needs' : 'levels need'} fixing first.
          </span>
        ) : (
          <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">Nothing changes until you review and save.</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-wds-sm px-1 font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary transition-colors hover:text-wds-text-ink focus-visible:outline-none focus-visible:shadow-wds-ring"
        >
          Discard
        </button>
        <Button size="lg" className="!px-5 text-[14px]" disabled={blocked} onClick={onReview}>
          Review changes
        </Button>
      </div>
    </div>
  );
}
