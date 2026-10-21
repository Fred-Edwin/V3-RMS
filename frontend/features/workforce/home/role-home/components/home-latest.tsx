'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover, useNow } from '../../../_shared';
import { safeHref } from '../../../notifications';
import { latestWhen } from '../lib/role-home-words';
import type { HomeLatest } from '../types/role-home-types';

export const NOTIFICATIONS_HREF = '/app/workforce/notifications';

/**
 * "Latest" (Paper 1.1 to 1.11): the five newest notifications. An unread row has a filled brown dot, a read one a hollow dot; the time
 * on the right is the clock today, YEST, then the date. "Mark all read" and "See all notifications" sit above and below. The bell in
 * the top bar keeps its own unread count. Rows with a safe link open it; the rest are plain text.
 */
export function HomeLatestList({ items, onMarkAllRead, busy = false }: { items: readonly HomeLatest[]; onMarkAllRead: () => void; busy?: boolean }) {
  const now = useNow();
  const anyUnread = items.some((n) => !n.read);
  return (
    <section aria-label="Latest" className="flex min-w-0 flex-col">
      <div className="flex items-baseline pb-2.5">
        <h2 className="m-0 font-wds-sans text-[18px] font-semibold leading-6 text-wds-text-ink">Latest</h2>
        <button type="button" disabled={!anyUnread || busy} onClick={onMarkAllRead} className={cn('ml-auto font-wds-sans text-[13px] font-medium leading-4 text-wds-warning-fg disabled:opacity-50', MOTION, FOCUS_RING, onHover('underline'))}>
          Mark all read
        </button>
      </div>
      <ul className="m-0 flex list-none flex-col border-t border-t-wds-neutral-800 p-0">
        {items.map((n) => {
          const href = safeHref(n.href);
          const body = (
            <>
              <span aria-hidden className={cn('mt-[5px] size-2 shrink-0 rounded-full border', n.read ? 'border-wds-neutral-400 bg-transparent' : 'border-wds-neutral-800 bg-wds-neutral-800')} />
              <span className="flex min-w-0 grow flex-col">
                <span className={cn('font-wds-sans text-[14px] leading-5 text-wds-text-ink', !n.read && 'font-medium')}>{n.title}</span>
                <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{n.body}</span>
              </span>
              <span className="shrink-0 font-wds-mono text-[11px] leading-4 text-wds-text-secondary">{latestWhen(n.createdAt, now)}</span>
              {n.read ? null : <span className="sr-only">Unread</span>}
            </>
          );
          const row = 'flex w-full items-start gap-2.5 px-1 py-3 text-left';
          return (
            <li key={n.id} className="border-b border-wds-neutral-100">
              {href ? (
                <Link href={href} className={cn(row, MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'))}>
                  {body}
                </Link>
              ) : (
                <div className={row}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      <Link href={NOTIFICATIONS_HREF} className={cn('mt-3 self-start font-wds-sans text-[13px] font-medium leading-4 text-wds-warning-fg', MOTION, FOCUS_RING, onHover('underline'))}>
        See all notifications
      </Link>
    </section>
  );
}
