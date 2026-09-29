import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { SearchInput, type SearchInputProps } from '@/components/ui2/search-input';

/**
 * Desktop Topbar — every desktop screen. Cross-feature shared, not
 * Inventory-specific. Reference: the real in-screen instance (Milestone One
 * `SFQ-0`'s topbar, Supplier form `SX5-0`'s `T2E-0`) — not specimen `1GS-0`
 * on the Shells & Primitives page, which draws an isolated floating card
 * (full border + radius) that no assembled screen actually uses.
 *
 * Structure: breadcrumb (section / screen · record-id) — global search — page
 * actions, slotted on the right (secondary + primary button, or whatever the
 * consuming screen needs). 56px tall, `wds-gradient-topbar`
 * (surface → topbar-end), full-bleed with a bottom border only — no radius,
 * no side/top border (confirmed via `get_computed_styles` on `T2E-0`: only
 * `borderBottomWidth`/`borderBottomColor` are set).
 */
export interface TopbarBreadcrumb {
  /** Optional static first segment for a three-level trail ("Central Store / Stock & counts / Coffee beans · ledger"). */
  root?: string;
  section: string;
  screen: string;
  /** Optional — when set, the section segment becomes a link back to it (e.g. a sub-screen returning to its list). Omit for the default static breadcrumb every other screen uses. */
  sectionHref?: string;
}

export interface TopbarProps {
  breadcrumb: TopbarBreadcrumb;
  searchProps?: SearchInputProps;
  /** Ref to the search `<input>` — e.g. for a ⌘K focus shortcut. */
  searchRef?: React.Ref<HTMLInputElement>;
  actions?: React.ReactNode;
  className?: string;
}

export function Topbar({ breadcrumb, searchProps, searchRef, actions, className }: TopbarProps) {
  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center gap-wds-3 border-b border-wds-border bg-wds-gradient-topbar px-wds-6',
        className
      )}
    >
      <div className="flex items-center gap-wds-2">
        {breadcrumb.root ? (
          <>
            <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{breadcrumb.root}</span>
            <span className="font-wds-sans text-wds-caption text-wds-text-faint">/</span>
          </>
        ) : null}
        {breadcrumb.sectionHref ? (
          <Link
            href={breadcrumb.sectionHref}
            className="font-wds-sans text-wds-caption text-wds-text-copy-muted outline-none transition-colors hover:text-wds-text-ink focus-visible:shadow-wds-ring"
          >
            {breadcrumb.section}
          </Link>
        ) : (
          <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{breadcrumb.section}</span>
        )}
        <span className="font-wds-sans text-wds-caption text-wds-text-faint">/</span>
        <span className="font-wds-sans text-wds-caption font-medium text-wds-text-ink">{breadcrumb.screen}</span>
      </div>

      <SearchInput
        ref={searchRef}
        {...searchProps}
        className={cn('ml-wds-4 w-[300px] shrink-0', searchProps?.className)}
      />

      {actions ? <div className="ml-auto flex items-center gap-wds-2">{actions}</div> : null}
    </header>
  );
}
