import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Hint Tooltip — a small CSS-only tooltip for a control that is drawn but
 * not yet usable (Milestone Six decision 1: Session-2 features render
 * disabled with "Coming with counting"). No tooltip artboard exists in Paper;
 * built on the toast's "raised · sm" tier (white surface, border, sm shadow).
 *
 * Why not a native `disabled` + `title`: a disabled button fires no hover or
 * focus events, so neither a title nor this tooltip would ever show, and it
 * drops out of the tab order entirely. The trigger stays focusable with
 * `aria-disabled` instead — reachable, never a trap, and the hint is its
 * accessible description.
 *
 * Motion (emil-design-eng): 125ms, fade + scale from 0.97, origin at the
 * trigger side, a short open delay so a passing pointer doesn't flash it,
 * instant close. Reduced motion keeps the fade only.
 */
export function HintTooltip({
  hint,
  side = 'bottom',
  align = 'center',
  className,
  children,
}: {
  hint: string;
  side?: 'bottom' | 'right' | 'top';
  /** Horizontal anchor for top/bottom hints — `end` for a trigger at the right screen edge so the hint never overflows the viewport. */
  align?: 'start' | 'center' | 'end';
  className?: string;
  children: (describedBy: string) => React.ReactNode;
}) {
  const id = React.useId();
  // Touch has no hover, and mobile browsers don't focus a tapped button — so
  // a tap focuses the aria-disabled trigger, which opens the hint through
  // `focus-within`; tapping anywhere else blurs it and the hint closes.
  const focusTrigger = (e: React.MouseEvent<HTMLSpanElement>) => {
    const trigger = e.currentTarget.querySelector<HTMLElement>('[aria-disabled="true"]');
    trigger?.focus({ preventScroll: true });
  };
  const vertical = side === 'top' || side === 'bottom';
  return (
    <span className={cn('group/hint relative inline-flex', className)} onClickCapture={focusTrigger}>
      {children(id)}
      <span
        id={id}
        role="tooltip"
        // Referenced by aria-describedby (which still resolves hidden text) —
        // hidden here so it isn't also read as page content.
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-wds-sm border border-wds-border bg-wds-surface px-2 py-1 font-wds-sans text-wds-caption text-wds-text-ink shadow-wds-sm',
          'opacity-0 transition-[opacity,transform] duration-0 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:scale-[0.97]',
          'group-hover/hint:opacity-100 group-hover/hint:delay-200 group-hover/hint:duration-[125ms] group-focus-within/hint:opacity-100 group-focus-within/hint:duration-[125ms] motion-safe:group-hover/hint:scale-100 motion-safe:group-focus-within/hint:scale-100',
          side === 'bottom' && 'top-[calc(100%+6px)] origin-top',
          side === 'top' && 'bottom-[calc(100%+6px)] origin-bottom',
          vertical && align === 'center' && 'left-1/2 -translate-x-1/2',
          vertical && align === 'start' && (side === 'top' ? 'left-0 origin-bottom-left' : 'left-0 origin-top-left'),
          vertical && align === 'end' && (side === 'top' ? 'right-0 origin-bottom-right' : 'right-0 origin-top-right'),
          side === 'right' && 'left-[calc(100%+8px)] top-1/2 -translate-y-1/2 origin-left',
        )}
      >
        {hint}
      </span>
    </span>
  );
}
