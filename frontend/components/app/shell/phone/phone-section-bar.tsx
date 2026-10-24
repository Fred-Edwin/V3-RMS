import Link from 'next/link';
import { Menu } from 'lucide-react';

import { cn } from '@/lib/cn';

const FOCUS = 'outline-none focus-visible:shadow-wds-ring';

/**
 * The phone top bar of a Workforce screen (Paper 1.9 to 1.11 and 10.2): 56 px of dark espresso, the menu on the left, the screen name with
 * the branch, department or feature under it in small mono capitals, and the bell with its unread count on the right. Both buttons are
 * 44 px to hit. Shown below 768 px.
 */
export function PhoneSectionBar({ title, kicker, unread, bellHref, onMenu, hideBell = false, className }: { title: string; kicker: string; unread: number; bellHref: string; onMenu: () => void; /** The notifications page itself draws no bell (Paper 13.2). */ hideBell?: boolean; className?: string }) {
  const text = unread > 99 ? '99+' : String(unread);
  return (
    <header className={cn('flex h-14 shrink-0 items-center gap-3 bg-[#2C1707] px-4', className)}>
      <button type="button" onClick={onMenu} aria-label="Open the menu" className={cn('-ml-2.5 flex size-11 shrink-0 items-center justify-center text-[#F5F3EF]', FOCUS)}>
        <Menu size={20} strokeWidth={1.75} aria-hidden />
      </button>
      <div className="flex min-w-0 grow flex-col">
        <span className="truncate font-wds-sans text-[15px] font-semibold leading-[18px] text-[#F5F3EF]">{title}</span>
        <span className="truncate font-wds-mono text-[10px] leading-3 tracking-[0.04em] text-[#8A7F76]">{kicker}</span>
      </div>
      {hideBell ? null : (
        <Link href={bellHref} aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'} className={cn('relative -mr-2.5 flex size-11 shrink-0 items-center justify-center text-[#F5F3EF]', FOCUS)}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />
          </svg>
          {unread > 0 ? (
            <span aria-hidden className="absolute right-[3px] top-[5px] flex h-[18px] min-w-[18px] items-center justify-center rounded-[2px] bg-[#693C1B] px-[5px] font-wds-mono text-[11px] font-semibold leading-[14px] text-[#F8F2EC]">
              {text}
            </span>
          ) : null}
        </Link>
      )}
    </header>
  );
}
