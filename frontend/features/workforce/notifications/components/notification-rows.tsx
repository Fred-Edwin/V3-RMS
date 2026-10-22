'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover } from '../../_shared';
import { clockText, groupByDay, safeHref, whenExact } from '../lib/notification-words';
import type { WorkforceNotification } from '../types/notification-types';

/** A security or "problem" row wears the red-brown dot; every other unread row the amber one (Paper 13.1, 13.2). */
const isProblem = (n: Pick<WorkforceNotification, 'area' | 'tone'>): boolean => n.area === 'SECURITY' || n.tone === 'problem';

interface RowProps {
  n: WorkforceNotification;
  phone: boolean;
  /** Called when the row is used: the caller marks it read and, in the drawer, closes it before the page opens. */
  onUse: (n: WorkforceNotification) => void;
}

/**
 * One notification (Paper 13.1 and 13.2): a dot (filled while unread), the area in mono capitals, the clock, the title and one grey line.
 * The whole row is the link. A row with no page to go to marks itself read when pressed, so nothing stays unread for want of somewhere to go.
 */
export function NotificationRow({ n, phone, onUse }: RowProps) {
  const href = safeHref(n.href);
  const dot = n.read ? 'border-[1.5px] border-wds-border-strong bg-transparent' : isProblem(n) ? 'bg-wds-error-fg' : 'bg-wds-warning-fg';
  const body = (
    <>
      <span aria-hidden className={cn('mt-[5px] size-2 shrink-0 rounded-full', phone && 'mt-1.5', dot)} />
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-3">
          <span className={cn('font-wds-mono text-[10px] leading-3 tracking-[0.06em]', isProblem(n) && !n.read ? 'text-wds-error-fg' : 'text-wds-text-secondary')}>{n.area}</span>
          <time dateTime={n.createdAt} title={whenExact(n.createdAt)} className="shrink-0 font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">
            {clockText(n.createdAt)}
          </time>
        </span>
        <span className={cn('font-wds-sans', phone ? 'text-[15px] leading-5' : 'text-[14px] leading-[18px]', n.read ? 'text-wds-neutral-700' : 'font-medium text-wds-text-ink')}>{n.title}</span>
        <span className={cn('font-wds-sans text-wds-text-secondary', phone ? 'text-[13px] leading-[18px]' : 'text-xs leading-4')}>{n.body}</span>
        {n.read ? null : <span className="sr-only">Unread</span>}
      </span>
    </>
  );
  const row = cn('flex w-full items-start gap-3 text-left', phone ? 'min-h-[72px] px-4 py-3.5' : 'px-5 py-3', MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'));
  if (href) {
    return (
      <Link href={href} onClick={() => onUse(n)} className={row}>
        {body}
      </Link>
    );
  }
  if (!n.read) {
    return (
      <button type="button" onClick={() => onUse(n)} className={row}>
        {body}
      </button>
    );
  }
  return <div className={row}>{body}</div>;
}

/** The rows under their day headings ("TODAY", "YESTERDAY", "MON 19 OCT"). */
export function NotificationDays({ items, now, phone, onUse }: { items: readonly WorkforceNotification[]; now: Date; phone: boolean; onUse: (n: WorkforceNotification) => void }) {
  return (
    <div>
      {groupByDay(items, now).map((group) => (
        <section key={group.heading} aria-label={group.heading}>
          <h3 className={cn('m-0 flex h-8 items-center border-b border-wds-border bg-wds-neutral-50 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary', phone ? 'px-4' : 'px-5')}>{group.heading}</h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {group.items.map((n) => (
              <li key={n.id} className="border-b border-wds-border">
                <NotificationRow n={n} phone={phone} onUse={onUse} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
