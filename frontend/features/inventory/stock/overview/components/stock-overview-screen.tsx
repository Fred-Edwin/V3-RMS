'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';
import { cn } from '@/lib/cn';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { ScwKpiStrip, ScwKpiStripSkeleton } from '../../../_shared/components/scw-kpi-strip';
import { ScwTopbar } from '../../../_shared/components/scw-topbar';
import { useLoader } from '../../../_shared/hooks/use-async';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { STOCK_STATES_COPY } from '../../_shared/lib/states-copy';
import { stockApi } from '../../_shared/services/stock-api';
import type { StockOverview } from '../../_shared/types/stock-contract';

const COUNTS = '/app/inventory/stock/counts';
const STATUS: Record<StockOverview['todaysCounts'][number]['status'], string> = {
  IN_PROGRESS: 'border-wds-info-border bg-wds-info-bg text-wds-info-fg',
  TO_REVIEW: 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg',
  SIGNED: 'border-wds-success-border bg-wds-success-bg text-wds-success-fg',
};

function Panel({ title, linkLabel, href, head, children }: { title: string; linkLabel: string; href: string; head: [string, string]; children: React.ReactNode }) {
  return (
    <section className="min-w-[380px] grow basis-0 border border-wds-border bg-wds-surface" aria-label={title}>
      <div className="flex h-[44px] items-center justify-between px-4">
        <h2 className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">{title}</h2>
        <Link href={href} className="font-wds-sans text-[13px] font-medium leading-4 text-wds-selected-edge underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring">
          {linkLabel} →
        </Link>
      </div>
      <div className="flex h-8 items-center justify-between border-b border-t border-b-wds-border border-t-wds-text-ink px-4 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
        <span>{head[0]}</span>
        <span>{head[1]}</span>
      </div>
      {children}
    </section>
  );
}

/**
 * Stock Overview (Paper step 42, `24DJ-0`; `/stock`), read only for every desktop role: the summary strip (Low or out and Negative
 * stock are one tap into All items), today's counts, and what has gone longest without a count. "Start count" shows only when the
 * server says the person may start one.
 */
export function StockOverviewScreen() {
  const router = useRouter();
  const { can, ready } = usePermissions();
  const ov = useLoader('stock-overview', () => stockApi.overview(), STOCK_STATES_COPY.overview.error);
  const d = ov.data;

  if (ready && !can('stock.read')) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ScwTopbar breadcrumb={{ root: 'Central Store', section: 'Stock & counts', screen: 'Overview' }} />
        <ScwStatePanel kind="permission" text={STOCK_STATES_COPY.overview.permission} className="m-8" />
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScwTopbar
        breadcrumb={{ section: 'Central Store', screen: 'Overview' }}
        actions={
          <>
            {can('waste.log') ? (
              <Button variant="secondary" asChild>
                <Link href="/app/inventory/stock/waste?drawer=log">Log waste</Link>
              </Button>
            ) : null}
            {d?.can.startCount || can('counts.record') ? (
              <Button asChild>
                <Link href={`${COUNTS}/new`}>Start count</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-mobile-title tracking-tight text-wds-text-ink">Overview</h1>
          <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">Where the Central Store stands today: what is low, what is negative, and which counts are done or due.</p>
        </div>
        {ov.status === 'error' ? (
          <ScwStatePanel kind="error" text={STOCK_STATES_COPY.overview.error} onRetry={() => void ov.reload()} />
        ) : !d ? (
          <>
            <LoadingAnnouncer text={STOCK_STATES_COPY.overview.loading} />
            <ScwKpiStripSkeleton />
            <div className="flex flex-wrap gap-5" aria-hidden>
              <Skeleton className="h-[220px] min-w-[380px] grow basis-0" />
              <Skeleton className="h-[220px] min-w-[380px] grow basis-0" />
            </div>
          </>
        ) : (
          <>
            <ScwKpiStrip
              cells={d.kpis}
              onFilter={(f) => router.push(`/app/inventory/stock/items?status=${f}`)}
            />
            <div className="flex flex-wrap items-start gap-5">
              <Panel title="Today's counts" linkLabel="All counts" href={COUNTS} head={['Count', 'Status']}>
                {d.todaysCounts.length === 0 ? (
                  <p className="px-4 py-6 font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">{STOCK_STATES_COPY.overview.empty}</p>
                ) : (
                  <ul>
                    {d.todaysCounts.map((c) => (
                      <li key={c.id} className="border-b border-wds-neutral-100 last:border-b-0">
                        <Link href={`${COUNTS}/${c.id}`} className="flex min-h-12 items-center gap-6 px-4 py-1.5 outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-ring)]">
                          <span className="w-[130px] shrink-0 font-wds-mono text-[12px] leading-4 text-wds-text-ink">{c.reference}</span>
                          <span className="flex grow flex-col">
                            <span className="font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">{c.what}</span>
                            <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{c.byText}</span>
                          </span>
                          <span className={cn('border px-2 py-0.5 font-wds-sans text-[12px] leading-4', STATUS[c.status])}>{c.statusText}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="Longest without a count" linkLabel="Count setup" href={`${COUNTS}/setup`} head={['Section or item', 'Last counted']}>
                <ul>
                  {d.longestWithoutCount.map((r) => (
                    <li key={`${r.kind}-${r.refId}`} className="flex min-h-12 items-center justify-between border-b border-wds-neutral-100 px-4 py-1.5 last:border-b-0">
                      <span className="flex flex-col">
                        <span className="font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">{r.name}</span>
                        <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                          {/^(section|item)\b/i.test(r.detail) ? r.detail : `${r.kind === 'SECTION' ? 'Section' : 'Item'} · ${r.detail}`}
                        </span>
                      </span>
                      <span className="font-wds-mono text-[13px] leading-4 text-wds-warning-fg">{r.lastCountedText.toLowerCase() === 'never counted' ? 'Never counted' : r.lastCountedText}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
