import Link from 'next/link';

import { cn } from '@/lib/cn';

import { statusLine, titleLine } from '../../../_shared/lib/leave-copy';
import { rangeShort } from '../../../_shared/lib/leave-dates';
import { myLeaveFollowHref, slipHref } from '../../../_shared/lib/leave-routes';
import type { MyRow } from '../../../_shared/types/leave-types';

const TONE = { warning: 'text-wds-warning-fg', success: 'text-wds-success-fg', error: 'text-wds-error-fg', muted: 'text-wds-text-secondary' } as const;

/** The 24 px state circle of a row: a ringed dot while waiting, a tick when approved, a cross when declined (a word always sits beside it). */
function StateCircle({ phase }: { phase: MyRow['phase'] }) {
  if (phase === 'WAITING') return <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-wds-caramel-600 bg-wds-warning-bg"><span className="h-2.5 w-2.5 rounded-full bg-wds-caramel-600" /></span>;
  const approved = phase === 'BOOKED' || phase === 'ON_LEAVE' || phase === 'TAKEN';
  return (
    <span aria-hidden className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white', approved ? 'bg-wds-success-fg' : phase === 'DECLINED' ? 'bg-wds-error-fg' : 'bg-wds-neutral-400')}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{approved ? <path d="M2.5 6.2l2.4 2.4 4.6-5" /> : <path d="M3 3l6 6M9 3l-6 6" />}</svg>
    </span>
  );
}

/** One request in History. The row is a link; the download button has a fixed 28 px slot (empty on rows without a slip) so the lanes line up. */
export function HistoryRow({ row, reasonCode }: { row: MyRow; reasonCode?: string | null }) {
  const status = statusLine(row, reasonCode);
  const hasSlip = row.slipCode !== null && row.status === 'APPROVED';
  return (
    <li className="flex min-h-[64px] items-stretch border-b border-wds-border last:border-b-0">
      <Link href={myLeaveFollowHref(row.id)} className="flex min-w-0 flex-1 items-center gap-3 py-4 pl-4 pr-2 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--wds-focus-ring,rgba(105,60,27,0.4))]">
        <StateCircle phase={row.phase} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{titleLine(row)}</span>
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{rangeShort(row.start, row.end)}</span>
          <span className={cn('font-wds-sans text-[12px] leading-4', TONE[status.tone])}>{status.text}</span>
        </span>
      </Link>
      <span className="flex w-[28px] shrink-0 items-center justify-center">
        {hasSlip ? (
          <Link href={slipHref(row.id)} aria-label={`Download leave slip, ${rangeShort(row.start, row.end)}`} className="flex h-7 w-7 items-center justify-center border border-wds-border-strong text-wds-text-ink hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:shadow-wds-ring">
            <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M7 2v7M4 6.5l3 3 3-3M2.5 12h9" /></svg>
          </Link>
        ) : null}
      </span>
      <span aria-hidden className="flex w-6 shrink-0 items-center justify-center pr-2 text-wds-neutral-400">›</span>
    </li>
  );
}
