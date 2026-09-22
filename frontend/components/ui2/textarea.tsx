import * as React from 'react';

import { cn } from '@/lib/cn';

/** WDS Textarea — modelled on `input.tsx`; radius 2, 1px border, same focus/invalid treatment. */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-16 w-full rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-3 py-wds-2.5 font-wds-sans text-wds-body text-wds-text-ink transition-colors',
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
Textarea.displayName = 'Textarea';

export { Textarea };
