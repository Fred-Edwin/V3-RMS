import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import type { ShellBarLink } from '../menu/use-shell-nav';

export interface BottomBarProps {
  links: readonly ShellBarLink[];
  pathname: string;
  onMenuClick: () => void;
  className?: string;
}

const under = (pathname: string, href: string): boolean => pathname === href || pathname.startsWith(`${href}/`);

const slot = 'relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 outline-none focus-visible:shadow-wds-ring';

/**
 * Phone bottom bar for floor staff in a department (Paper "Floor staff bottom bar", 12 Oct 2026): their quick links from the
 * navigation table, then Menu, which opens the same drawer as the top-bar menu button. It is a flex sibling at the foot of the
 * content column, so a page can never scroll under it; the safe-area padding keeps it above a phone's home indicator. Hidden from
 * `lg` up, where the sidebar is.
 */
export function BottomBar({ links, pathname, onMenuClick, className }: BottomBarProps) {
  return (
    <nav aria-label="Quick links" className={cn('flex shrink-0 items-stretch border-t border-wds-border bg-wds-surface pb-[env(safe-area-inset-bottom)] [[data-number-pad]_&]:hidden', className)}>
      {links.map((link) => {
        const active = under(pathname, link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.key}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            aria-label={link.count ? `${link.label}, ${link.count} waiting` : link.label}
            className={cn(slot, 'h-16 border-t-2', active ? 'border-wds-caramel-500 text-wds-espresso-700' : 'border-transparent text-wds-text-muted')}
          >
            <Icon aria-hidden className="size-[22px]" />
            <span className={cn('font-wds-sans text-wds-field-label', active ? 'font-semibold' : 'font-medium')}>{link.label}</span>
            {link.count ? (
              <span aria-hidden className="absolute left-1/2 top-1.5 ml-1.5 flex h-4 min-w-4 items-center justify-center bg-wds-espresso-700 px-1 font-wds-mono text-[10px] font-semibold text-white">
                {link.count}
              </span>
            ) : null}
          </Link>
        );
      })}
      <button type="button" onClick={onMenuClick} aria-label="Open menu" className={cn(slot, 'h-16 border-t-2 border-transparent text-wds-text-muted')}>
        <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <span className="font-wds-sans text-wds-field-label font-medium">Menu</span>
      </button>
    </nav>
  );
}
