import * as React from 'react';

import { cn } from '@/lib/cn';

import type { JobCardRow } from '../../lib/job-card-rows';

/** The rows of the Job card (frames 7.1 and 12.1): a 150 px label column, values starting in one line, 48 px rows (56 with a second line). */
export function JobCardRows({ rows }: { rows: readonly JobCardRow[] }) {
  return (
    <dl className="m-0 flex flex-col px-5 pb-2 pt-1">
      {rows.map((r) => (
        <div key={r.label} className={cn('flex items-center border-b border-wds-border last:border-b-0', r.sub ? 'h-14' : 'h-12')}>
          <dt className="w-[150px] shrink-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{r.label}</dt>
          <dd className="m-0 flex min-w-0 flex-col gap-px">
            <span
              className={cn(
                'text-[14px] leading-[18px]',
                r.mono ? 'font-wds-mono' : 'font-wds-sans',
                r.strong ? 'font-semibold text-wds-text-ink' : r.warning ? 'text-wds-warning-fg' : r.muted ? 'text-wds-text-secondary' : 'text-wds-text-ink'
              )}
            >
              {r.main}
            </span>
            {r.sub ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{r.sub}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
