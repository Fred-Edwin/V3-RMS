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
import { CountStatusChip } from '../../_shared/components/count-chips';
import { clockLabel, dayClockLabel, signedKes, signedMoney, signedQty } from '../../_shared/lib/count-format';
import { COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import { CAUSE_TEXT } from '../../_shared/types/counting-contract';

const COUNTS = '/app/inventory/stock/counts';

/**
 * Count signed (Paper step 15, `1Z61-0`; `/stock/counts/[id]/signed`): what a signed count of the person's own did. What was applied
 * to stock, what was flagged to the Director with each cause and whether it has been seen, what was not counted, the timeline of
 * what happened, and who can read the record. "Print record" opens the printed page; "Start count" starts another.
 */
export function SignedCountScreen({ countId }: { countId: string }) {
  const router = useRouter();
  const { can } = usePermissions();
  const detail = useLoader(`count:${countId}`, () => countingApi.detail(countId), COUNTING_STATES_COPY.countSigned.error);
  const count = detail.data;

  React.useEffect(() => {
    if (count?.status === 'OPEN') router.replace(`${COUNTS}/${count.id}/count`);
  }, [count, router]);

  const topbar = (title: string) => (
    <ScwTopbar
      search={false}
      breadcrumb={{ root: 'Central Store', section: 'Counts', sectionHref: COUNTS, screen: title }}
      actions={
        can('counts.record') ? (
          <Button asChild>
            <Link href={`${COUNTS}/new`}>Start count</Link>
          </Button>
        ) : undefined
      }
    />
  );

  if (detail.status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {topbar('Count')}
        <ScwStatePanel kind="error" text={COUNTING_STATES_COPY.countSigned.error} onRetry={() => void detail.reload()} className="m-8" />
      </div>
    );
  }
  if (!count || !count.figures) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {topbar('Count')}
        <LoadingAnnouncer text="Getting the signed count" />
        <div className="flex flex-col gap-5 px-8 pt-7" aria-hidden>
          <Skeleton className="h-9 w-80" />
          <ScwKpiStripSkeleton count={3} />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const fig = count.figures;
  const flagged = count.lines.filter((l) => l.director?.flagged);
  const flaggedNet = flagged.reduce((a, l) => a + Number(l.differenceValueKes ?? 0), 0);
  const notCounted = count.lines.filter((l) => l.result === 'NOT_COUNTED');
  const applied = count.lines.filter((l) => l.adjustmentRef);
  const unseen = flagged.filter((l) => !l.director?.seenAt).length;
  const sectionsText = count.sections.map((s) => s.name).join(', ');
  const cells = [
    { key: 'applied', label: 'APPLIED TO STOCK', value: `${applied.length} line${applied.length === 1 ? '' : 's'}`, caption: `Within the range · net ${signedKes(fig.withinRangeNetKes)}`, tone: 'NEUTRAL' as const },
    { key: 'flagged', label: 'FLAGGED TO THE DIRECTOR', value: `${flagged.length} line${flagged.length === 1 ? '' : 's'}`, caption: `Outside the range · ${signedKes(String(flaggedNet))}`, tone: 'ALERT' as const },
    { key: 'notCounted', label: 'NOT COUNTED', value: `${notCounted.length} item${notCounted.length === 1 ? '' : 's'}`, caption: notCounted.length > 0 ? `${notCounted.map((l) => l.itemName).join(', ')} · nothing written` : 'Everything was counted', tone: 'NEUTRAL' as const },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {topbar(count.reference)}
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h1 className="font-wds-sans text-wds-mobile-title tracking-tight text-wds-text-ink">{count.reference}</h1>
              <CountStatusChip status={count.status} text={count.statusText} />
            </div>
            <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">
              {sectionsText} · counted and signed by {count.counter.name} · {count.signedAt ? dayClockLabel(count.signedAt).replace(/^\d+ \w+ /, 'today ') : ''} · {fig.counted} of {count.progress.total} items
            </p>
          </div>
          {count.can.print ? (
            <Button variant="secondary" asChild>
              <a href={`/app/inventory/count-print/${count.id}`} target="_blank" rel="noreferrer">
                Print record<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
          ) : null}
        </div>

        <ScwKpiStrip cells={cells} successKeys={['applied']} />

        <div className="flex flex-wrap items-start gap-8">
          <section className="flex min-w-[420px] grow basis-0 flex-col gap-3" aria-labelledby="flagged-title">
            <h2 id="flagged-title" className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
              Flagged lines · the Director's view
            </h2>
            {flagged.length === 0 ? (
              <p className="border border-wds-border bg-wds-surface px-4 py-6 font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">Nothing was outside the range, so nothing was flagged.</p>
            ) : (
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr className="h-[34px] border-b border-t border-b-wds-border border-t-wds-text-ink font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
                    <th className="pl-3.5 text-left font-normal">Item</th>
                    <th className="w-[140px] text-right font-normal">Difference</th>
                    <th className="w-[100px] text-right font-normal">Value</th>
                    <th className="w-[170px] pl-6 text-left font-normal">Cause</th>
                    <th className="w-[130px] pr-3.5 text-right font-normal">Director</th>
                  </tr>
                </thead>
                <tbody>
                  {flagged.map((l) => (
                    <tr key={l.id} className="h-[52px] border-b border-wds-neutral-100 bg-wds-surface">
                      <td className="pl-3.5 font-wds-sans text-[14px] leading-5 text-wds-text-ink">{l.itemName}</td>
                      <td className="text-right font-wds-mono text-[13px] leading-4 text-wds-error-fg">{signedQty(l.difference ?? '0', l.unit)}</td>
                      <td className="text-right font-wds-mono text-[13px] leading-4 text-wds-error-fg">{signedMoney(l.differenceValueKes ?? '0')}</td>
                      <td className="pl-6 font-wds-sans text-[13px] leading-4 text-wds-text-ink">{l.decision?.cause ? CAUSE_TEXT[l.decision.cause] : 'No cause given'}</td>
                      <td className={cn('pr-3.5 text-right font-wds-sans text-[12px] leading-4', l.director?.seenAt ? 'text-wds-success-fg' : 'text-wds-warning-fg')}>
                        {l.director?.seenAt ? `Seen${l.director.seenBy ? ` by ${l.director.seenBy.name.split(' ')[0]}` : ''}` : 'Not seen yet'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <aside className="flex w-[300px] shrink-0 flex-col gap-4 border border-wds-border bg-wds-surface p-5" aria-labelledby="happened-title">
            <h2 id="happened-title" className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
              What happened
            </h2>
            <ol className="flex flex-col gap-3.5">
              {(count.timeline ?? []).map((t) => {
                const waiting = /^Director told/.test(t.label) && unseen > 0;
                return (
                  <li key={t.label} className="flex items-start gap-3">
                    <span className={cn('mt-1.5 size-2.5 shrink-0', waiting ? 'border border-wds-selected-edge' : 'bg-wds-success-fg')} aria-hidden />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-wds-sans text-[14px] leading-5 text-wds-text-ink">{t.label}</span>
                      <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">
                        {t.detail && !waiting ? `${clockLabel(t.at)} · ${t.detail}` : waiting ? `${clockLabel(t.at)} · waiting to be seen` : t.detail ?? clockLabel(t.at)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="border-t border-wds-border pt-4 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">
              Everyone with access can read this record: Director, Accountant, Branch Manager and System Admin.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
