import * as React from 'react';

import { cn } from '@/lib/cn';

/** The small pieces the Branch day desktop screens repeat: status icons, the mono label, the section card rule. Values are Paper's (see branch-day-paper-spec §1, §3). */

/** Paper's mono label at 10/12 (`L1`): "USED TODAY (KES)", "SIGNED BY". */
export function MonoLabel({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <span id={id} className={cn('font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary', className)}>
      {children}
    </span>
  );
}

/** A green disc with a white tick (the OK blocker row, the tracker). 18 by 18 on Today, 16 on the file strip. */
export function CheckDisc({ size = 18, strokeWidth = 2.2, className }: { size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn('shrink-0', className)}>
      <circle cx="12" cy="12" r="12" fill="#2F6438" />
      <path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The red disc with a white "!" (a row that blocks the close; Paper C20: the "!" and not a tick). */
export function BlockDisc({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn('shrink-0', className)}>
      <circle cx="12" cy="12" r="12" fill="#97281D" />
      <path d="M12 6.5v7M12 17v.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** The amber ring with a "!" (a heads-up that does not block). */
export function HeadsUpRing({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn('shrink-0', className)}>
      <circle cx="12" cy="12" r="10" stroke="#8A5A16" strokeWidth="2" />
      <path d="M12 7.5v6M12 16.5v.5" stroke="#8A5A16" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Paper's text link in `--color-primary` (#B0610F): "See every line", "See all 43 in the day file", "Cancel". */
export const PRESS = 'transition-[color,background-color,transform] duration-150 ease-out motion-safe:active:scale-[0.97]';
export const PRIMARY_LINK = `${PRESS} font-wds-sans text-[13px] font-medium leading-[18px] text-wds-selected-edge outline-none focus-visible:shadow-wds-ring [@media(hover:hover)]:hover:underline`;
