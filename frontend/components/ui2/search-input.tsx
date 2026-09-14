import * as React from 'react';
import { Search } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * WDS SearchInput — Input composition, not a separate base primitive (the
 * field set is just Input + leading icon + trailing ⌘K hint). Matches Paper's
 * topbar search box (SI9-0): h-8, radius 2, border (not border-strong),
 * bg-surface. Paper draws the leading glyph as a bare circle (a placeholder at
 * that zoom level, not a deliberate icon design) — used lucide's real Search
 * icon instead so it actually reads as "search" to a user, sized/positioned to
 * match Paper's circle exactly.
 */
export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  shortcutHint?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, shortcutHint = '⌘K', placeholder = 'Search items', ...props }, ref) => {
    return (
      <div
        className={cn(
          'flex h-8 items-center gap-wds-2 rounded-wds-sm border border-wds-border bg-wds-surface px-wds-2.5',
          'focus-within:border-wds-primary focus-within:shadow-wds-ring',
          className
        )}
      >
        <Search className="h-3 w-3 shrink-0 text-wds-text-faint" strokeWidth={1.5} aria-hidden />
        <input
          type="text"
          ref={ref}
          placeholder={placeholder}
          className="min-w-0 grow bg-transparent font-wds-sans text-wds-body-sm text-wds-text-ink outline-none placeholder:text-wds-text-faint"
          {...props}
        />
        {shortcutHint ? (
          <span className="ml-auto shrink-0 font-wds-mono text-wds-mono-sm text-wds-text-faint">
            {shortcutHint}
          </span>
        ) : null}
      </div>
    );
  }
);
SearchInput.displayName = 'SearchInput';

export { SearchInput };
