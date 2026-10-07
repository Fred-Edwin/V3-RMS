import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';
import { formatKesCompact } from '../../_shared/lib/prep-format';
import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import type { RunsSummary } from '../../_shared/types/prep-contract';

const label = 'font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-copy-muted';
const sub = 'font-wds-sans text-wds-caption text-wds-text-copy-muted';

function Cell({ title, value, caption, tone, last }: { title: string; value: string; caption: string; tone?: 'warning'; last?: boolean }) {
  return (
    <div className={cn('flex min-w-0 flex-1 basis-0 flex-col gap-[5px] px-5 py-4', !last && 'border-r border-wds-border')}>
      <dt className={label}>{title}</dt>
      <dd className="m-0 flex flex-col gap-[5px]">
        <span className={cn('truncate font-wds-mono text-[28px] leading-[34px]', tone === 'warning' ? 'text-wds-warning-fg' : 'text-wds-text-ink')}>{value}</span>
        <span className={sub}>{caption}</span>
      </dd>
    </div>
  );
}

export interface KpiStripProps {
  summary: RunsSummary | null;
  status: 'loading' | 'ready' | 'error';
  onRetry: () => void;
}

/**
 * The manager's week at a glance (Paper step 10 `7GG-0`): Runs this week, Needs a look, and the prep value of the last 7 days.
 * The money cell is there only when the server sent `prepValue7d` (`prep.see_costs`), so a role without costs sees two cells.
 */
export function KpiStrip({ summary, status, onRetry }: KpiStripProps) {
  if (status === 'error') {
    return (
      <div role="alert" className="flex items-center justify-between gap-wds-3 border border-wds-border bg-wds-surface px-5 py-4">
        <span className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{PREP_STATES_COPY.summary.errorTitle}.</span>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="flex border border-wds-border bg-wds-surface" aria-busy="true" aria-label="Loading this week's figures">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn('flex flex-1 flex-col gap-[5px] px-5 py-4', i < 2 && 'border-r border-wds-border')}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-[34px] w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    );
  }
  const hasValue = summary.prepValue7d !== undefined;
  return (
    <dl aria-label="This week" className="m-0 flex border border-wds-border bg-wds-gradient-surface-raise">
      <Cell title="Runs this week" value={String(summary.runsThisWeek)} caption={`${summary.runsToday} today`} />
      <Cell
        title="Needs a look"
        value={String(summary.needsLookCount)}
        caption={summary.needsLookCount === 0 ? 'nothing waiting' : 'waiting for your review'}
        tone={summary.needsLookCount > 0 ? 'warning' : undefined}
        last={!hasValue}
      />
      {hasValue ? <Cell title="Prep value (7d)" value={formatKesCompact(summary.prepValue7d ?? '0')} caption="input cost consumed" last /> : null}
    </dl>
  );
}
