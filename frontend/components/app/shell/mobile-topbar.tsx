import * as React from 'react';

import { cn } from '@/lib/cn';

export interface MobileTopbarProps {
  /** Screen name, from the navigation table. */
  title: string;
  orgLabel: string;
  initials: string;
  onMenuClick: () => void;
  className?: string;
}

/**
 * Phone top bar for old pages inside the shell: the hamburger that opens the nav drawer, "Wendo RMS · <org>", the avatar, and the
 * screen name. Same dark ground as `MobileHubHeader` (the rebuilt screens draw that one themselves, so they never get this).
 */
export function MobileTopbar({ title, orgLabel, initials, onMenuClick, className }: MobileTopbarProps) {
  return (
    <header className={cn('flex shrink-0 items-center gap-wds-2.5 bg-wds-sidebar-mid px-wds-4 py-wds-3', className)}>
      <button type="button" onClick={onMenuClick} aria-label="Open menu" className="flex size-8 shrink-0 items-center justify-center rounded-wds-sm outline-none focus-visible:shadow-wds-ring">
        <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
          <path d="M1 1H17M1 7H17M1 13H17" fill="none" stroke="var(--wds-sidebar-fg-item)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-wds-mono text-wds-field-label uppercase text-wds-caramel">Wendo RMS &middot; {orgLabel}</span>
        <span className="truncate font-wds-sans text-wds-body-sm font-medium text-wds-sidebar-fg-active">{title}</span>
      </div>
      <div className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-full bg-wds-espresso-600 font-wds-sans text-wds-caption text-white">{initials}</div>
    </header>
  );
}
