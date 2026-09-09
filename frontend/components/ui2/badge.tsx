import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

/**
 * WDS Badge — count badges (nav / tabs) and neutral/semantic tags.
 * For row status use <StatusDot> instead (dot + label, no fill).
 */
const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-wds-sm font-wds-mono text-wds-mono-sm font-semibold',
  {
    variants: {
      variant: {
        neutral: 'bg-wds-neutral-100 text-wds-neutral-700 px-wds-1 min-w-[18px] h-[18px]',
        primary: 'bg-wds-sidebar-badge-bg text-wds-sidebar-badge-fg px-wds-1 min-w-[18px] h-[18px]',
        success: 'bg-wds-success-bg text-wds-success-fg border border-wds-success-border px-wds-2 h-5',
        warning: 'bg-wds-warning-bg text-wds-warning-fg border border-wds-warning-border px-wds-2 h-5',
        error: 'bg-wds-error-bg text-wds-error-fg border border-wds-error-border px-wds-2 h-5',
        info: 'bg-wds-info-bg text-wds-info-fg border border-wds-info-border px-wds-2 h-5',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
