import * as React from 'react';

import { cn } from '@/lib/cn';

import { SectionHeader } from './section-header';

/**
 * "People by branch" (HR Home, Paper PNM-0): a name and a count over a 6 px bar, one line per site. The bar is that site's share of
 * everyone active (42 of 89 is 47 %), so the longest bar is not always full. A grey note below says who is not counted.
 */
export interface BranchCount {
  key: string;
  name: string;
  count: number;
}

export function PeopleByBranch({ rows, note, className }: { rows: readonly BranchCount[]; note?: string; className?: string }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return (
    <section aria-label="People by branch" className={cn('flex min-w-0 flex-col', className)}>
      <SectionHeader title="People by branch" mono={`${total} ACTIVE`} />
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((row) => {
          const share = total > 0 ? Math.round((row.count / total) * 100) : 0;
          return (
            <li key={row.key} className="flex flex-col gap-[7px] border-b border-wds-border py-3.5">
              <div className="flex justify-between">
                <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{row.name}</span>
                <span className="font-wds-mono text-[13px] leading-4 text-wds-text-ink">{row.count}</span>
              </div>
              <div role="img" aria-label={`${row.name}: ${row.count} of ${total}, ${share} percent`} className="h-1.5 shrink-0 bg-wds-neutral-100">
                <div className="h-1.5 bg-wds-primary" style={{ width: `${share}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      {note ? <p className="m-0 pt-3.5 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">{note}</p> : null}
    </section>
  );
}
