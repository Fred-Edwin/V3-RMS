import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

/**
 * The bell in the top bar (Paper 1.1): an outlined bell, and a small brown box with the unread number at its corner ("99+" over 99).
 * Nothing unread draws no box. It is a link to the person's notifications, so it works with the keyboard and a screen reader says how many.
 */
export function TopbarBell({ href, unread, onClick, className }: { href: string; unread: number; /** Lets a desktop screen open a drawer instead of following the link. */ onClick?: React.MouseEventHandler<HTMLAnchorElement>; className?: string }) {
  const text = unread > 99 ? '99+' : String(unread);
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      className={cn('relative flex size-9 items-center justify-center border border-wds-border-strong bg-wds-surface text-wds-text-ink outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring', className)}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3L4 11Z" />
        <path d="M6.5 14a1.7 1.7 0 0 0 3 0" />
      </svg>
      {unread > 0 ? (
        <span aria-hidden className="absolute -right-1 -top-1.5 flex h-4 min-w-4 items-center justify-center bg-wds-primary px-1 font-wds-mono text-[10px] font-medium leading-none text-wds-primary-fg">
          {text}
        </span>
      ) : null}
    </Link>
  );
}
