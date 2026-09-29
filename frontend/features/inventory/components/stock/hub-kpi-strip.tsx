'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import type { StockSummary, TodaysCount } from '../../types/stock';
import { HighlightOnChange } from './highlight-on-change';
import { KpiValueSkeleton } from './stock-states';
import { formatClock, formatKesCompact, formatNumber, shortName } from './stock-format';

/** SM desktop KPI cell (`1AYW-0`): "Awaiting SM / submitted 07:10 by S. Achieng". */
export function todaysCountCopy(count: TodaysCount | undefined): { value: string; detail: string; tone: 'neutral' | 'warning' } {
  if (!count || count.status === 'NOT_STARTED') return { value: 'No count yet', detail: 'none submitted today', tone: 'neutral' };
  if (count.status === 'DRAFT') {
    return { value: 'In progress', detail: `${count.countedLines ?? 0} of ${count.totalLines ?? 0} counted so far`, tone: 'neutral' };
  }
  if (count.status === 'SUBMITTED') {
    const by = count.submittedByName ? ` by ${shortName(count.submittedByName)}` : '';
    return { value: 'Awaiting SM', detail: `submitted ${count.submittedAt ? formatClock(count.submittedAt) : ''}${by}`, tone: 'warning' };
  }
  if (count.status === 'RETURNED') return { value: 'Sent back', detail: 'waiting on the recount', tone: 'warning' };
  return { value: 'Verified', detail: 'today’s count is signed', tone: 'neutral' };
}


const kpiCellClass =
  'flex grow basis-0 flex-col gap-1.5 bg-wds-gradient-surface-raise p-4 text-left outline-none';

function KpiLabel({ children }: { children: React.ReactNode }) {
  return <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">{children}</span>;
}

export function HubKpiStrip({ summary, loading, errored = false }: { summary: StockSummary | null; loading: boolean; errored?: boolean }) {
  const count = todaysCountCopy(summary?.todaysCount);
  const linkCell = (href: string, label: string, children: React.ReactNode, border = true) => (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        kpiCellClass,
        'group/kpi transition-[background-color] duration-150 hover:bg-none hover:bg-wds-neutral-50 focus-visible:z-10 focus-visible:shadow-wds-ring',
        border && 'border-r border-wds-border',
      )}
    >
      {children}
    </Link>
  );
  return (
    <div className="flex w-full shrink-0 overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
      {linkCell(
        '/app/inventory/stock/items',
        'On-hand value — view all items',
        <>
          <KpiLabel>On-hand value</KpiLabel>
          {loading || !summary ? (
            <KpiValueSkeleton static={errored} />
          ) : (
            <>
              <HighlightOnChange value={summary.onHandValue} className="font-wds-mono text-wds-kpi font-medium text-wds-text-ink">
                {formatKesCompact(summary.onHandValue)}
              </HighlightOnChange>
              <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{formatNumber(summary.itemCount)} items tracked</span>
            </>
          )}
        </>,
      )}
      {linkCell(
        '/app/inventory/stock/items?belowRestock=true',
        'Low stock — view items below restock level',
        <>
          <KpiLabel>Low stock</KpiLabel>
          {loading || !summary ? (
            <KpiValueSkeleton static={errored} />
          ) : (
            <>
              <HighlightOnChange value={summary.lowCount} className="font-wds-mono text-wds-kpi font-medium text-wds-warning-fg" />
              <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">below restock level — consider buying</span>
            </>
          )}
        </>,
      )}
      {linkCell(
        '/app/inventory/stock/items?negative=true',
        'Negative — view items with negative on-hand',
        <>
          <KpiLabel>Negative</KpiLabel>
          {loading || !summary ? (
            <KpiValueSkeleton static={errored} />
          ) : (
            <>
              <HighlightOnChange value={summary.negativeCount} className="font-wds-mono text-wds-kpi font-medium text-wds-error-fg" />
              <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">need a spot count</span>
            </>
          )}
        </>,
      )}
      {(() => {
        const tc = summary?.todaysCount;
        const cellBody = (
          <>
            <KpiLabel>Today’s count</KpiLabel>
            {loading || !summary ? (
              <KpiValueSkeleton static={errored} />
            ) : (
              <>
                <HighlightOnChange value={count.value} className={cn('font-wds-mono text-wds-kpi font-medium', count.tone === 'warning' ? 'text-wds-text-ink' : 'text-wds-text-faint')} />
                <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{count.detail}</span>
              </>
            )}
          </>
        );
        if (tc?.countId && tc.status !== 'NOT_STARTED' && tc.status !== 'DRAFT') {
          return (
            <Link
              href={`/app/inventory/stock/counts?id=${tc.countId}`}
              aria-label="Today’s count — open it"
              className={cn(kpiCellClass, 'transition-[background-color] duration-150 hover:bg-none hover:bg-wds-neutral-50 focus-visible:z-10 focus-visible:shadow-wds-ring')}
            >
              {cellBody}
            </Link>
          );
        }
        return <div className={kpiCellClass}>{cellBody}</div>;
      })()}
    </div>
  );
}

