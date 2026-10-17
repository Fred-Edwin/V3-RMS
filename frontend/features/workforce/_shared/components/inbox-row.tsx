'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, PRESSED, onHover } from '../lib/interaction';
import { NOTIFICATION_KIND_TONE, type NotificationKind, type NotificationTone } from '../lib/notification-copy';

/**
 * Inbox row: the five-part notification template (Paper "Shared · Notifications",
 * 19S3-0). The coloured left bar is the kind; 1 area and kind (mono), 2 when,
 * 3 what changed, 4 who and why, 5 one optional action.
 *
 * A notification only informs, so the action opens a screen and never asks for a
 * decision. "When" is the short word ("3 min", "Yesterday"); the exact time is on
 * hover via `whenExact`, and in the audit log.
 */
const barClass: Record<NotificationTone, string> = {
  info: 'border-l-wds-info-fg',
  // Paper's amber bar is #B27A0A, which has no token; caramel-600 is the nearest. See README.
  amber: 'border-l-wds-caramel-600',
  success: 'border-l-wds-success-fg',
  error: 'border-l-wds-error-fg',
};

export function InboxRow({
  areaKind,
  kind,
  when,
  whenExact,
  title,
  whoAndWhy,
  action,
  unread = false,
  className,
}: {
  /** "ROTA CHANGE". Written in capitals by the caller. */
  areaKind: string;
  kind: NotificationKind;
  when: string;
  whenExact?: string;
  title: string;
  whoAndWhy?: string;
  /** Outlined by default (a list has many rows, rule 04). `primary` (brown) is for one lone card on a screen. */
  action?: { label: string; onClick: () => void; emphasis?: 'primary' | 'outlined' };
  /** A quiet dot before the area label, for a row not yet opened (built beyond Paper). */
  unread?: boolean;
  className?: string;
}) {
  const tone = NOTIFICATION_KIND_TONE[kind];
  return (
    <article
      className={cn('flex flex-col gap-1.5 border border-l-4 border-wds-border bg-wds-surface px-[22px] py-5', barClass[tone], className)}
    >
      <header className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">
          {unread ? (
            <>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-wds-selected-edge" />
              <span className="sr-only">Unread. </span>
            </>
          ) : null}
          {areaKind}
        </span>
        <time title={whenExact} className="font-wds-sans text-[11px] leading-[14px] text-wds-text-muted">
          {when}
        </time>
      </header>
      <h3 className="m-0 font-wds-sans text-[17px] font-semibold leading-[22px] text-wds-text-ink">{title}</h3>
      {whoAndWhy ? <p className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{whoAndWhy}</p> : null}
      {action ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={action.onClick}
            className={cn(
              'inline-flex h-[34px] items-center px-4 font-wds-sans text-[13px] font-medium leading-4',
              MOTION,
              FOCUS_RING,
              PRESSED,
              action.emphasis === 'primary'
                ? cn('bg-wds-primary text-wds-primary-fg', onHover('bg-wds-primary-hover'))
                : cn('border border-wds-border-strong text-wds-text-ink', onHover('bg-wds-neutral-50'))
            )}
          >
            {action.label}
          </button>
        </div>
      ) : null}
    </article>
  );
}
