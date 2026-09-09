import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * WDS StatusDot — the row-status indicator from the Paper "Accent" artboard.
 * A 6px dot + label, both in the same semantic color. No fill, no border.
 * The dot carries the color; the label carries the meaning.
 */
const toneClass = {
  success: 'text-wds-success-fg',
  warning: 'text-wds-warning-fg',
  error: 'text-wds-error-fg',
  info: 'text-wds-info-fg',
  neutral: 'text-wds-text-secondary',
} as const;

const dotClass = {
  success: 'bg-wds-success-fg',
  warning: 'bg-wds-warning-fg',
  error: 'bg-wds-error-fg',
  info: 'bg-wds-info-fg',
  neutral: 'bg-wds-neutral-500',
} as const;

export type StatusTone = keyof typeof toneClass;

export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
  children: React.ReactNode;
}

function StatusDot({ tone, children, className, ...props }: StatusDotProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[7px] font-wds-sans text-wds-body-sm',
        toneClass[tone],
        className
      )}
      {...props}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-wds-full', dotClass[tone])} aria-hidden />
      {children}
    </span>
  );
}

export { StatusDot };
