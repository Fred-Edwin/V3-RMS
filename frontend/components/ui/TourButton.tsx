'use client';

import { Compass } from 'lucide-react';
import { cn } from '@/lib/cn';

interface TourButtonProps {
  onClick: () => void;
  /** Override the default label ("Take the tour"). */
  label?: string;
  className?: string;
}

/**
 * Shared "Take the tour" button. Pairs with `usePageTour` — pass the hook's
 * `startTour` as `onClick`. Themed to the design system (espresso/cream) and kept
 * compact so it sits comfortably in a page header beside other controls.
 *
 * Part of the reusable onboarding primitive; not page-specific.
 */
export function TourButton({ onClick, label = 'Take the tour', className }: TourButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-espresso/30 bg-crema px-3 py-1.5',
        'text-[12px] font-semibold text-espresso transition-colors',
        'hover:bg-espresso hover:text-crema hover:border-espresso',
        'focus-visible:outline-none focus-visible:shadow-focus',
        className,
      )}
    >
      <Compass size={14} strokeWidth={2} aria-hidden />
      {label}
    </button>
  );
}
