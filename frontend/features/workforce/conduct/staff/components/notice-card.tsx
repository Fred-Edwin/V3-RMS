'use client';

import Link from 'next/link';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover, StatusText, type ValueTone } from '../../../_shared';
import { staffNoticeHref } from '../../_shared/lib/routes';
import type { StaffItem } from '../../_shared/types/conduct-types';

/**
 * One notice on the staff list (Paper 2ZFG-0): title, one line, the status word in a 56 px slot, a 28 px download square and a chevron.
 * The whole card opens the notice; the download square is its own button, so a tap on it never opens the notice. A notice waiting to be
 * signed carries an amber left bar; one that ended, was replaced or withdrawn is grey. The download square is absent where there is no letter.
 */
export function NoticeCard({
  item,
  tone,
  onDownload,
  downloading,
  muted,
}: {
  item: StaffItem;
  tone: ValueTone;
  onDownload: (item: StaffItem) => void;
  downloading: boolean;
  muted: boolean;
}) {
  const waiting = item.canSign;
  return (
    <li className={cn('relative flex items-stretch border border-wds-border bg-wds-surface', waiting && 'border-l-4 border-l-wds-caramel-600', muted && 'bg-wds-neutral-50')}>
      <Link
        href={staffNoticeHref(item.id)}
        className={cn('flex min-h-[64px] min-w-0 flex-1 items-center gap-3 py-3 pl-3.5 pr-2', MOTION, FOCUS_RING, 'focus-visible:z-10', onHover('bg-wds-neutral-50'))}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn('truncate font-wds-sans text-[14px] font-medium leading-[18px]', muted ? 'text-wds-text-secondary' : 'text-wds-text-ink')}>{item.title}</span>
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{item.headline}</span>
        </span>
        <span className="w-14 shrink-0 text-right">
          <StatusText tone={tone}>
            <span className="sr-only">Status: </span>
            {item.statusWord}
          </StatusText>
        </span>
        <span aria-hidden className="w-2 shrink-0 text-wds-text-faint">
          ›
        </span>
      </Link>
      {item.hasLetter ? (
        <button
          type="button"
          onClick={() => onDownload(item)}
          disabled={downloading}
          aria-label={`Download signed notice ${item.number ?? item.title}`}
          className={cn('my-auto mr-3 flex size-11 shrink-0 items-center justify-center', MOTION, FOCUS_RING)}
        >
          <span aria-hidden className={cn('flex size-7 items-center justify-center border border-wds-border-strong text-[14px] leading-none text-wds-text-ink', downloading && 'opacity-60')}>
            {downloading ? '…' : '↓'}
          </span>
        </button>
      ) : null}
    </li>
  );
}
