import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover } from '../../_shared';

/**
 * The title line over every Home block: a 15 px semibold title on an ink rule, with a link or a mono caption at the right
 * (Paper PMF-0, PNN-0, POI-0, Q5H-0). `size="sm"` is the 32 px line of the Today board; `md` is the 36 px line of the Home columns.
 */
export function SectionHeader({
  title,
  count,
  countTone = 'error',
  caption,
  mono,
  link,
  size = 'md',
  className,
}: {
  title: string;
  /** A small coloured count after the title ("Needs a look 4"). */
  count?: number | string;
  countTone?: 'error' | 'success';
  /** Plain grey words at the right ("By department"). */
  caption?: string;
  /** Mono capitals at the right ("89 ACTIVE", "NEXT 4 WEEKS"). */
  mono?: string;
  /** A text link at the right ("View all 11"). Pass only when the person may open it. */
  link?: { label: string; onClick: () => void };
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={cn('flex shrink-0 items-baseline justify-between border-b border-wds-text-ink', size === 'sm' ? 'h-8' : 'h-9', className)}>
      <div className="flex items-center gap-2.5">
        <h2 className="m-0 font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-text-ink">{title}</h2>
        {count !== undefined ? (
          <span
            className={cn(
              'border px-[7px] py-px font-wds-mono text-[13px] font-medium leading-4',
              countTone === 'error' ? 'border-wds-error-border bg-wds-error-bg text-wds-error-fg' : 'border-wds-success-border bg-wds-success-bg text-wds-success-fg'
            )}
          >
            {count}
          </span>
        ) : null}
      </div>
      {link ? (
        <button type="button" onClick={link.onClick} className={cn('font-wds-sans text-[13px] leading-4 text-wds-warning-fg', MOTION, FOCUS_RING, onHover('underline'))}>
          {link.label}
        </button>
      ) : mono ? (
        <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">{mono}</span>
      ) : caption ? (
        <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{caption}</span>
      ) : null}
    </div>
  );
}
