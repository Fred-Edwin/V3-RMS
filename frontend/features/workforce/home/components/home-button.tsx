'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { DISABLED, FOCUS_RING, MOTION, PRESSED, onHover } from '../../_shared';

/**
 * The small buttons inside Home rows and cards (Paper PMO-0, PXK-0, QK2-0): `outlined` (grey border), `primary` (brown) and `danger`
 * (the red tint of "Mark absent"). The kit's `DialogButton` is the 38 px dialog button and `PhoneButton` the tall phone one; Home rows
 * need the 28 px desktop size and the 36 px card size, which the kit does not have. Interaction comes from the kit's classes.
 * A button the person may not use is not rendered: the screen passes an action only when allowed.
 */
export type HomeButtonKind = 'outlined' | 'primary' | 'danger';
export type HomeButtonSize = 'row' | 'compact' | 'card';

const SIZE: Record<HomeButtonSize, string> = {
  /** Attention row (Paper 30 high, 70 wide minimum). */
  row: 'h-[30px] min-w-[70px] justify-center px-3 text-[13px] leading-4',
  /** Branch rows and the side list (28 high). */
  compact: 'h-7 px-3 text-[12px] leading-4',
  /** Phone card (36 high). */
  card: 'h-9 px-4 text-[14px] leading-5',
};

export interface HomeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: HomeButtonKind;
  size?: HomeButtonSize;
}

export const HomeButton = React.forwardRef<HTMLButtonElement, HomeButtonProps>(function HomeButton({ kind = 'outlined', size = 'row', className, type = 'button', ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap border font-wds-sans',
        SIZE[size],
        MOTION,
        FOCUS_RING,
        PRESSED,
        DISABLED,
        kind === 'primary' && cn('border-wds-primary bg-wds-primary font-medium text-wds-primary-fg', size === 'compact' && 'px-3.5', size === 'card' && 'px-5', onHover('bg-wds-primary-hover')),
        kind === 'outlined' && cn('border-wds-border-strong bg-transparent text-wds-text-ink', onHover('bg-wds-neutral-50')),
        kind === 'danger' && cn('border-wds-error-border bg-wds-error-bg text-wds-error-fg', onHover('border-wds-error-fg')),
        className
      )}
      {...props}
    />
  );
});
