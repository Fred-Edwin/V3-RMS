'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { DateRangePicker, type DateRange } from '@/components/ui2/date-range-picker';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { useAuthStore } from '@/store/authStore';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2Empty, B2Header, Chip, ListSkeleton, PagerBar, RefLink } from '../../../_shared/components/block2-phone-parts';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { couldNotLoad, EMPTY_COPY, resultChip } from '../../../_shared/lib/block2-words';
import { DELIVERY_RESULTS, type DeliveryResult } from '../../../dispatch/_shared/types/dispatch-contract';
import { dateTimeText, fullDateText } from '../../../requisitions/lib/time';
import { useDeliveriesList } from '../../hooks/use-deliveries';
import { deliveryFile, DELIVERIES_HOME } from '../../lib/delivery-routes';

const PAGE_SIZE = 25;
const nairobiDay = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(d);
const daysBefore = (day: string, n: number): string => new Date(new Date(`${day}T00:00:00Z`).getTime() - n * 86_400_000).toISOString().slice(0, 10);
const RESULT_TEXT: Record<DeliveryResult, string> = { MATCHED: 'All matched', GAP_OPEN: 'Gap open', GAP_RESOLVED: 'Gap resolved' };

/**
 * My deliveries (gap fix G2): past deliveries with the result of each. A member's History is this list alone; a head's History keeps its
 * Requisitions tab (Block 1) and adds this one, so the head's screen renders it with `withTabs`.
 */
export function MyDeliveriesList({ withTabs = false }: { withTabs?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const orgName = useAuthStore((s) => s.user?.organizationName ?? '');
  const department = useAuthStore((s) => s.departmentTag);
  const [today] = React.useState(() => nairobiDay(new Date()));
  const range: DateRange = React.useMemo(() => ({ from: params.get('from') ?? daysBefore(today, 29), to: params.get('to') ?? today }), [params, today]);
  const result = DELIVERY_RESULTS.find((r) => r === params.get('result'));
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const list = useDeliveriesList({ tab: 'past', from: range.from, to: range.to, result, page, pageSize: PAGE_SIZE });
  const data = list.data;

  const setQuery = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [params, pathname, router],
  );

  let body: React.ReactNode;
  if (list.status === 'error' && !data) {
    body = (
      <div role="alert">
        <MobileErrorState title="Could not load deliveries" description={couldNotLoad('your deliveries')} onRetry={() => void list.reload()} />
      </div>
    );
  } else if (!data) {
    body = (
      <>
        <LoadingAnnouncer text="Loading your deliveries" />
        <ListSkeleton rows={5} />
      </>
    );
  } else if (data.rows.length === 0) {
    body = <B2Empty title={EMPTY_COPY.myDeliveries.title} description={EMPTY_COPY.myDeliveries.line} />;
  } else {
    body = (
      <>
        <ul className="border border-wds-border bg-wds-surface">
          {data.rows.map((row) => {
            const chip = resultChip(row.result, row.gapCount);
            return (
              <li key={row.id} className="flex items-center gap-2.5 border-b border-wds-neutral-100 px-3.5 py-3 last:border-b-0">
                <div className="flex min-w-0 grow basis-0 flex-col gap-[3px]">
                  <RefLink reference={row.reference} href={deliveryFile(row.id)} className="text-[13px] leading-4" />
                  <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">
                    {row.lineCount} {row.lineCount === 1 ? 'line' : 'lines'} · from the Central Store
                  </span>
                  <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{row.confirmedAt ? `Confirmed ${dateTimeText(row.confirmedAt)}` : 'Not confirmed'}</span>
                </div>
                {chip ? <Chip spec={chip} /> : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 border border-wds-info-border bg-wds-info-bg px-3 py-2.5 font-wds-sans text-[12px] leading-4 text-wds-info-fg">Open a delivery to see what you counted, what was sent, and how a gap ended.</p>
      </>
    );
  }

  const tabs = withTabs
    ? {
        items: [
          { key: 'requisitions', label: 'Requisitions' },
          { key: 'deliveries', label: 'Deliveries' },
        ],
        active: 'deliveries',
        label: 'History',
        onChange: (key: string) => {
          if (key === 'requisitions') router.push('/app/requisitions/history');
        },
      }
    : undefined;

  return (
    <PhoneColumn>
      <B2Header title="History" subtitle={department ? `${fullDateText(new Date().toISOString())} · ${department.charAt(0)}${department.slice(1).toLowerCase()}` : fullDateText(new Date().toISOString())} leading="back" onBack={() => router.push(withTabs ? '/app/requisitions' : DELIVERIES_HOME)} place={orgName} tabs={tabs} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-canvas p-4">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker label="Date" today={today} value={range} onChange={(r) => setQuery({ from: r?.from ?? null, to: r?.to ?? null, page: null })} buttonClassName="h-[34px] max-sm:h-[34px] rounded-none px-3 font-wds-sans text-[13px] leading-4" />
          <label className="relative flex h-[34px] items-center border border-wds-border-strong bg-wds-surface">
            <span className="sr-only">Result</span>
            <select aria-label="Result" value={result ?? ''} onChange={(e) => setQuery({ result: e.target.value || null, page: null })} className="h-full appearance-none bg-transparent pl-3 pr-8 font-wds-sans text-[13px] leading-4 text-wds-text-ink outline-none focus-visible:shadow-wds-ring">
              <option value="">Result: All</option>
              {DELIVERY_RESULTS.map((r) => (
                <option key={r} value={r}>
                  Result: {RESULT_TEXT[r]}
                </option>
              ))}
            </select>
            <span aria-hidden="true" className="pointer-events-none absolute right-3 text-[9px] text-wds-text-ink">▾</span>
          </label>
        </div>
        <div className="mt-3 flex flex-col">{body}</div>
        <div className="grow" />
        {data && data.page.total > 0 ? <PagerBar page={page} pageSize={PAGE_SIZE} total={data.page.total} shown={data.rows.length} onPage={(p) => setQuery({ page: p === 1 ? null : String(p) })} noun="" /> : null}
      </div>
    </PhoneColumn>
  );
}
