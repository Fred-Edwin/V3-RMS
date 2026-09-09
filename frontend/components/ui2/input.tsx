import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * WDS Input — matches the Paper "Primitives" artboard.
 * Height 32, radius 2, 1px border. Focus = espresso border + soft ring.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-8 w-full rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-3 font-wds-sans text-wds-body-sm text-wds-text-ink transition-colors',
          'placeholder:text-wds-text-muted',
          'focus-visible:outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'aria-[invalid=true]:border-wds-error-fg',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
