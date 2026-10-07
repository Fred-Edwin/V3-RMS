'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';

import { cn } from '@/lib/cn';

/**
 * The square tick box of the Counting redesign (Paper `1YND-0`, `23EH-0`, `1XIC-0`): a hairline square, and when ticked a solid
 * espresso fill with a white tick (not the blue-edged box of the purchasing picker). 18 px in the section and item lists, 14 px
 * in the review table header and rows. A real checkbox: keyboard (Space), focus ring, disabled state, checked/indeterminate.
 */
export const ScwCheckbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { size?: 14 | 18 }
>(({ className, size = 18, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'grid shrink-0 place-content-center border-[1.5px] border-wds-neutral-400 bg-wds-surface outline-none transition-colors duration-100 focus-visible:shadow-wds-ring',
      '[@media(hover:hover)]:hover:border-wds-neutral-600 disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:border-[var(--wds-primary-btn-end)] data-[state=checked]:bg-[var(--wds-primary-btn-end)] data-[state=indeterminate]:border-[var(--wds-primary-btn-end)]',
      size === 18 ? 'size-[18px]' : 'size-3.5',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="text-white">
      <svg width={size === 18 ? 12 : 9} height={size === 18 ? 12 : 9} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
ScwCheckbox.displayName = 'ScwCheckbox';
