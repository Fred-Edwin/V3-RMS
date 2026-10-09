'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/authStore';
import { useMobileNavDrawer } from '../hooks/use-mobile-nav-drawer';
import { initialsOf } from './phone-parts';

/**
 * The Store Attendant's phone screens (Counting and Waste) as a centred phone-width column inside the same shell at every width
 * (owner, 8 Oct 2026): the column is the Paper artboard width (390) and may grow to 480; the page background fills the rest; the
 * header is the dark Paper band with a back chevron (a task) or the menu button (a landing screen), never a status bar and never
 * bottom tabs. The Manager's phone width uses the same column.
 */
export function PhoneColumn({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
      <div className={cn('mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col bg-wds-canvas', className)}>{children}</div>
    </div>
  );
}

export interface ScwPhoneHeaderProps {
  title: string;
  subtitle: string;
  /** `back` for a task opened from another screen, `menu` for a landing screen (the shell's nav drawer). */
  leading: 'back' | 'menu';
  onBack?: () => void;
  /** The line after "WENDO RMS ·" (default "HUB"; a branch screen passes the branch name, "NYERI TOWN"). */
  place?: string;
  className?: string;
}

/** Paper steps 1 to 7 header: 20 px of space above a 4 px inset, 22/28 title, 13/18 subtitle (`1WGH-0`). */
export function ScwPhoneHeader({ title, subtitle, leading, onBack, place = 'HUB', className }: ScwPhoneHeaderProps) {
  const initials = useAuthStore((s) => initialsOf(s.user?.name));
  const { open } = useMobileNavDrawer();
  return (
    <header className={cn('flex shrink-0 flex-col bg-wds-sidebar-top pt-5', className)}>
      <div className="flex flex-col gap-2.5 px-4 pb-[18px] pt-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={leading === 'back' ? onBack : open}
            aria-label={leading === 'back' ? 'Back' : 'Open menu'}
            className="-m-[11px] flex size-11 shrink-0 items-center justify-center rounded-wds-sm text-white outline-none transition-opacity duration-150 focus-visible:shadow-wds-ring active:opacity-70"
          >
            {leading === 'back' ? (
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <span className="grow font-wds-mono text-[11px] leading-[14px] tracking-[0.08em] text-wds-espresso-400">WENDO RMS · {place}</span>
          <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[15px] bg-wds-espresso-800 font-wds-mono text-[11px] leading-[14px] text-wds-sidebar-badge-fg" aria-hidden="true">
            {initials}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <h1 className="font-wds-sans text-[22px] font-semibold leading-7 text-white">{title}</h1>
          <p className="font-wds-sans text-[13px] leading-[18px] text-wds-sidebar-fg-item">{subtitle}</p>
        </div>
      </div>
    </header>
  );
}
