'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';
import { cn } from '@/lib/cn';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { ScwTopbar } from '../../../_shared/components/scw-topbar';
import { useLoader } from '../../../_shared/hooks/use-async';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { plainQty, signedKes, signedMoney } from '../../../counting/_shared/lib/count-format';
import { STOCK_STATES_COPY } from '../../_shared/lib/states-copy';
import { stockApi } from '../../_shared/services/stock-api';
import type { StockCardDay } from '../../_shared/types/stock-contract';
import { DateRangePicker } from './date-range-picker';

const cell = (v: string, red = false, plus = false): React.ReactNode => {
  const n = Number(v);
  return <span className={cn('font-wds-mono', n === 0 ? 'text-wds-text-faint' : red && n < 0 ? 'text-wds-error-fg' : plus && n > 0 ? 'text-wds-success-fg' : 'text-wds-text-ink')}>{n === 0 ? '0' : `${plus && n > 0 ? '+' : ''}${plainQty(v).replace('-', '−')}`}</span>;
};
const REF = /^(ADJ|DSP|GRN|CNT|PREP)-/;

/**
 * One item's stock card (Paper step 29, `22OO-0`; `/stock/ledger/[itemId]`), read only: on hand now with its status, value, last
 * counted, a period strip, and one row per day with the references of what moved it. "Show · By day / By entries" and the chips
 * "Days with movement" and "Adjustments only" narrow it; older quiet days collapse into one row; a day opens in place to its entries.
 */
export function StockCardScreen({ itemId }: { itemId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { can, ready } = usePermissions();
  const from = params.get('from') ?? undefined;
  const to = params.get('to') ?? undefined;
  const show = (params.get('show') as 'byDay' | 'entries' | null) ?? 'byDay';
  const chip = (params.get('chip') as 'daysWithMovement' | 'adjustmentsOnly' | null) ?? undefined;
  const key = `card:${itemId}:${from}:${to}:${show}:${chip}`;
  const card = useLoader(key, () => stockApi.card(itemId, { from, to, show, chip }), STOCK_STATES_COPY.stockCard.error);
  const d = card.data;
  const [open, setOpen] = React.useState<string | null>(null);
  const t = React.useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date()), []);

  const set = (patch: Record<string, string | null>): void => {
    const q = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k)));
    router.replace(`/app/inventory/stock/ledger/${itemId}?${q}`, { scroll: false });
  };
  const chipCls = (on: boolean) => cn('border px-3 py-1.5 font-wds-sans text-[12px] leading-4 outline-none transition-colors focus-visible:shadow-wds-ring', on ? 'border-wds-text-ink bg-wds-text-ink text-white' : 'border-wds-border-strong bg-wds-surface text-wds-text-ink hover:bg-wds-neutral-50');
  const back = `/app/inventory/stock/ledger${from && to ? `?from=${from}&to=${to}` : ''}`;
  const tone = d?.status === 'NEGATIVE' ? 'text-wds-error-fg' : d && d.status !== 'OK' ? 'text-wds-warning-fg' : 'text-wds-text-ink';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScwTopbar
        breadcrumb={{ section: 'Central Store', screen: 'Stock ledger' }}
        actions={
          <>
            {can('waste.log') ? <Button variant="secondary" asChild><Link href="/app/inventory/stock/waste?drawer=log">Log waste</Link></Button> : null}
            {can('counts.record') ? <Button asChild><Link href="/app/inventory/stock/counts/new">Start count</Link></Button> : null}
          </>
        }
      />
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-8 py-6">
        <div className="flex flex-col gap-1">
          <Link href={back} className="w-fit font-wds-sans text-[13px] leading-4 text-wds-selected-edge underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring">← Stock ledger</Link>
          <h1 className="font-wds-sans text-wds-mobile-title tracking-tight text-wds-text-ink">{d?.item.name ?? <Skeleton className="inline-block h-7 w-56 align-middle" />}</h1>
          <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">{d ? `${d.item.sectionName ?? 'No section'} · ${d.item.locationName} · opening, in, sent out and closing for each day` : ''}</p>
        </div>
        {ready && !can('stock.read') ? (
          <ScwStatePanel kind="permission" text={STOCK_STATES_COPY.stockCard.permission} />
        ) : card.status === 'error' ? (
          <ScwStatePanel kind="error" text={STOCK_STATES_COPY.stockCard.error} onRetry={() => void card.reload()} />
        ) : !d ? (
          <>
            <LoadingAnnouncer text={STOCK_STATES_COPY.stockCard.loading} />
            <Skeleton className="h-[108px] w-full" aria-hidden />
            <Skeleton className="h-14 w-full" aria-hidden />
            <Skeleton className="h-64 w-full" aria-hidden />
          </>
        ) : (
          <>
            <div className="flex flex-wrap border border-wds-border bg-wds-surface">
              {[
                ['ON HAND NOW', `${plainQty(d.onHand)} ${d.item.unit}`, `${d.statusText}${d.status === 'OK' ? '' : ' · below the restock level'}`, tone],
                ['VALUE', signedKes(d.valueKes), d.unitCostText, 'text-wds-text-ink'],
                ['LAST COUNTED', d.lastCounted ? d.lastCounted.text.split(' · ')[0] ?? '' : 'Never', d.lastCounted ? d.lastCounted.reference : 'No count yet', 'text-wds-text-ink'],
              ].map(([l, v, c, cls], i, a) => (
                <div key={l} className={cn('flex min-w-[220px] grow basis-0 flex-col gap-1 px-5 py-4', i < a.length - 1 && 'border-r border-wds-border')}>
                  <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">{l}</span>
                  <span className={cn('font-wds-mono text-[28px] leading-[34px]', cls)}>{v}</span>
                  <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{c}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border border-wds-border bg-wds-surface px-5 py-3.5" role="group" aria-label="Period summary">
              <div className="flex flex-col"><span className="font-wds-mono text-[10px] uppercase leading-3 text-wds-text-secondary">Last {d.periodText}</span><span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{d.from} to {d.to}</span></div>
              {([['Opening', d.strip.opening, false, false], ['In', d.strip.in, false, true], ['Sent out', d.strip.sentOut, false, false], ['Prep use', d.strip.prepUse, false, false], ['Waste', d.strip.waste, false, false], ['Adjusted', d.strip.adjusted, true, true], ['Closing', d.strip.closing, false, false]] as const).map(([l, v, red, plus]) => (
                <div key={l} className="flex flex-col"><span className="font-wds-mono text-[10px] uppercase leading-3 text-wds-text-secondary">{l}</span><span className="text-[16px] leading-5">{l === 'Closing' ? <span className="font-wds-mono font-semibold">{plainQty(v)} {d.item.unit}</span> : cell(v, red, plus)}</span></div>
              ))}
            </div>
            <div className="border border-wds-border bg-wds-surface">
              <div className="flex flex-wrap items-center gap-2 px-4 py-3.5">
                <DateRangePicker value={{ from: d.from, to: d.to }} today={t} onChange={(r) => set({ from: r.from, to: r.to })} />
                <button type="button" onClick={() => set({ show: show === 'byDay' ? 'entries' : null })} className="h-8 border border-wds-border-strong bg-wds-surface px-3 font-wds-sans text-[13px] outline-none hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring">Show · {show === 'byDay' ? 'By day' : 'By entries'} ⌄</button>
                <button type="button" aria-pressed={chip === 'daysWithMovement'} onClick={() => set({ chip: chip === 'daysWithMovement' ? null : 'daysWithMovement' })} className={chipCls(chip === 'daysWithMovement')}>Days with movement</button>
                <button type="button" aria-pressed={chip === 'adjustmentsOnly'} onClick={() => set({ chip: chip === 'adjustmentsOnly' ? null : 'adjustmentsOnly' })} className={chipCls(chip === 'adjustmentsOnly')}>Adjustments only</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse">
                  <thead>
                    <tr className="h-[34px] border-b border-t border-b-wds-border border-t-wds-text-ink font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
                      <th className="pl-4 text-left font-normal">Day</th><th className="text-left font-normal">Reference</th>
                      {['Opening', 'In', 'Sent out', 'Prep use', 'Waste', 'Adjusted', 'Closing', 'Value (KES)'].map((h) => <th key={h} className="pr-4 text-right font-normal">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {d.days.length === 0 ? (
                      <tr><td colSpan={10} className="px-4 py-6 font-wds-sans text-[13px] text-wds-text-secondary">{STOCK_STATES_COPY.stockCard.empty}</td></tr>
                    ) : d.days.map((day: StockCardDay, i) => {
                      const first = i === 0;
                      const expandable = !day.collapsed && Boolean(day.references.length);
                      return (
                        <React.Fragment key={day.day}>
                          <tr
                            className={cn('h-11 border-b border-wds-neutral-100', first ? 'bg-wds-espresso-50' : 'bg-wds-surface', expandable && 'cursor-pointer hover:bg-wds-neutral-50')}
                            tabIndex={expandable ? 0 : undefined}
                            aria-expanded={expandable ? open === day.day : undefined}
                            onClick={() => expandable && setOpen(open === day.day ? null : day.day)}
                            onKeyDown={(e) => { if (expandable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(open === day.day ? null : day.day); } }}
                          >
                            <td className="pl-4 font-wds-sans text-[14px] text-wds-text-ink">{day.dayText}</td>
                            <td className="font-wds-sans text-[12px]">
                              {day.collapsed ? <span className="text-wds-text-secondary">{day.referenceText}</span> : day.references.map((r, j) => <span key={r} className={cn(REF.test(r) ? 'font-wds-mono text-wds-selected-edge' : 'text-wds-text-secondary')}>{j > 0 ? ' · ' : ''}{r}</span>)}
                            </td>
                            <td className="pr-4 text-right">{cell(day.opening)}</td><td className="pr-4 text-right">{cell(day.in, false, true)}</td><td className="pr-4 text-right">{cell(day.sentOut)}</td>
                            <td className="pr-4 text-right">{cell(day.prepUse)}</td><td className="pr-4 text-right">{cell(day.waste)}</td><td className="pr-4 text-right">{cell(day.adjusted, true, true)}</td>
                            <td className="pr-4 text-right font-wds-mono font-semibold">{plainQty(day.closing)}</td><td className="pr-4 text-right font-wds-mono">{signedMoney(day.closingValueKes)}</td>
                          </tr>
                          {(show === 'entries' || open === day.day) && day.entries?.length ? day.entries.map((en) => (
                            <tr key={en.id} className="h-9 border-b border-wds-neutral-100 bg-wds-neutral-50 font-wds-sans text-[12px] text-wds-text-secondary">
                              <td className="pl-8" colSpan={2}>{en.type.replace('_', ' ').toLowerCase()}{en.reference ? ` · ${en.reference}` : ''}{en.reversed ? ' · reversed' : ''}</td>
                              <td colSpan={8} className="pr-4 text-right font-wds-mono">{Number(en.quantity) > 0 ? '+' : ''}{plainQty(en.quantity).replace('-', '−')} {d.item.unit}</td>
                            </tr>
                          )) : null}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-wds-border bg-wds-neutral-50 px-4 py-2.5 font-wds-mono text-[11px] leading-4 text-wds-text-secondary">{d.footerText} · each row adds up: opening + in − out + adjusted = closing</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
