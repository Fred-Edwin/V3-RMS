'use client';

import Link from 'next/link';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover } from '../../../_shared';
import { monthLong, rowLine } from '../lib/pay-words';
import { payslipHref } from '../lib/routes';
import type { PayslipListItem } from '../types/payslip-types';
import { Amount } from './amount';

/** One payslip in a list (home, history): month and pay line at the left, the net (or dots) and a chevron at the right. A link of at least 44 px. */
export function PayslipRow({ item, shown }: { item: PayslipListItem; shown: boolean }) {
  const line = rowLine(item);
  return (
    <li className="border-b border-wds-neutral-100 last:border-b-0">
      <Link
        href={payslipHref(item.id)}
        aria-label={`${monthLong(item.month)}${item.versionNumber > 1 ? `, version ${item.versionNumber}` : ''}, ${line.text}${shown ? '' : ', amount hidden'}`}
        className={cn('flex min-h-[56px] items-center justify-between gap-3 px-3.5 py-3', MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'))}
      >
        <span className="flex min-w-0 flex-col">
          <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{monthLong(item.month)}</span>
          <span className={cn('font-wds-sans text-[12px] leading-4', line.paid ? 'text-wds-success-fg' : 'text-wds-text-secondary')}>{line.text}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Amount value={item.net} shown={shown} className="text-[14px] leading-[18px] text-wds-text-ink" />
          <span aria-hidden className="text-wds-neutral-400">
            ›
          </span>
        </span>
      </Link>
    </li>
  );
}
