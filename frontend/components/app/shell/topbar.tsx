import * as React from 'react';

import { cn } from '@/lib/cn';
import { SearchInput, type SearchInputProps } from '@/components/ui2/search-input';

/**
 * Desktop Topbar — every desktop screen. Cross-feature shared, not
 * Inventory-specific. Reference: Session-0 shell, Paper page `3-0`,
 * node `1GO-0` / specimen `1GS-0`.
 *
 * Structure: breadcrumb (section / screen · record-id) — global search — page
 * actions, slotted on the right (secondary + primary button, or whatever the
 * consuming screen needs). 56px tall, `wds-gradient-topbar`
 * (surface → topbar-end), 1px border, radius 4.
 */
export interface TopbarBreadcrumb {
  section: string;
  screen: string;
}

export interface TopbarProps {
  breadcrumb: TopbarBreadcrumb;
  searchProps?: SearchInputProps;
  actions?: React.ReactNode;
  className?: string;
}

export function Topbar({ breadcrumb, searchProps, actions, className }: TopbarProps) {
  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center gap-wds-3 rounded-wds-md border border-wds-border bg-wds-gradient-topbar px-wds-6',
        className
      )}
    >
      <div className="flex items-center gap-wds-2">
        <span className="font-wds-sans text-wds-caption text-wds-text-muted">{breadcrumb.section}</span>
        <span className="font-wds-sans text-wds-caption text-wds-text-faint">/</span>
        <span className="font-wds-sans text-wds-caption font-medium text-wds-text-ink">{breadcrumb.screen}</span>
      </div>

      <SearchInput
        {...searchProps}
        className={cn('ml-wds-4 w-[300px] shrink-0', searchProps?.className)}
      />

      {actions ? <div className="ml-auto flex items-center gap-wds-2">{actions}</div> : null}
    </header>
  );
}
