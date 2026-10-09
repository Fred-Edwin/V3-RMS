'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { DateRangePicker, type DateRange } from '@/components/ui2/date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui2/select';
import { Skeleton } from '@/components/ui2/skeleton';
import { MobileEmptyState, MobileErrorState } from '@/components/app/shell/mobile-states';
import { useAuthStore } from '@/store/authStore';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { REQUISITIONS_KIT_COPY } from '../../_shared/lib/states-copy';
import { cancelReasonText, HISTORY_COPY } from '../../_shared/lib/phone-words';
import { REQUISITION_STATUSES, REQUISITION_STATUS_TEXT, type HistoryMineRow, type RequisitionStatus } from '../../_shared/types/requisitions-contract';
import { useHistoryMine } from '../../hooks/use-head-requisitions';
import { B2TabBar } from '../../../_shared/components/block2-phone-parts';
import { REQ_HISTORY, REQ_HOME, reqFile } from '../../lib/routes';
import { dateTimeText, fullDateText, shortDateText } from '../../lib/time';
import { HeadPhoneHeader } from './head-phone-parts';
import { StatusChip } from './head-home-screen';

const PAGE_SIZE = 25;
const nairobiDay = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(d);
const daysBefore = (day: string, n: number): string => new Date(new Date(`${day}T00:00:00Z`).getTime() - n * 86_400_000).toISOString().slice(0, 10);
const titleCase = (s: string): string => s.charAt(0) + s.slice(1).toLowerCase();

/** The head's History (gap fix G1). The Deliveries tab is Block 2's and is not drawn here. */
export function HeadHistoryScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const department = useAuthStore((s) => s.departmentTag);
  const [today] = React.useState(() => nairobiDay(new Date()));

  const range: DateRange = React.useMemo(() => ({ from: params.get('from') ?? daysBefore(today, 29), to: params.get('to') ?? today }), [params, today]);
  const statusParam = params.get('status');
  const status: RequisitionStatus | undefined = REQUISITION_STATUSES.find((s) => s === statusParam);
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

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

  const history = useHistoryMine({ from: range.from, to: range.to, status, page, pageSize: PAGE_SIZE });
  const data = history.data;
  const total = data?.page.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PhoneColumn>
      <HeadPhoneHeader variant="history" leading="back" onBack={() => router.push(REQ_HOME)} title={HISTORY_COPY.title} subtitle={HISTORY_COPY.subtitle(fullDateText(new Date().toISOString()), department ? titleCase(department) : '')}>
        <div className="-mx-4 -mb-4 mt-1">
          <B2TabBar
            items={[
              { key: 'requisitions', label: 'Requisitions' },
              { key: 'deliveries', label: 'Deliveries' },
            ]}
            active="requisitions"
            label="History"
            onChange={(key) => {
              if (key === 'deliveries') router.push(`${REQ_HISTORY}?tab=deliveries`);
            }}
          />
        </div>
      </HeadPhoneHeader>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-canvas p-4">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            label="Date"
            today={today}
            value={range}
            onChange={(r) => setQuery({ from: r?.from ?? null, to: r?.to ?? null, page: null })}
            buttonClassName="h-11 rounded-none px-3 font-wds-sans text-[13px]"
          />
          <Select value={status ?? 'ALL'} onValueChange={(v) => setQuery({ status: v === 'ALL' ? null : v, page: null })}>
            <SelectTrigger aria-label="Status" className="h-11 w-auto min-w-[120px] gap-2 rounded-none px-3 font-wds-sans text-[13px]">
              <span>{status ? HISTORY_COPY.statusLabel(REQUISITION_STATUS_TEXT[status]) : HISTORY_COPY.statusAll}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {REQUISITION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {REQUISITION_STATUS_TEXT[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          {history.status === 'error' ? (
            <div role="alert">
              <MobileErrorState title={REQUISITIONS_KIT_COPY.couldNotLoad.title} description={HISTORY_COPY.error} onRetry={() => void history.reload()} />
            </div>
          ) : !data ? (
            <>
              <LoadingAnnouncer text={HISTORY_COPY.loading} />
              <ul className="border border-wds-border bg-wds-surface" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 border-b border-wds-border px-4 py-3.5 last:border-b-0">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-7 w-16" />
                  </li>
                ))}
              </ul>
            </>
          ) : data.rows.length === 0 ? (
            <MobileEmptyState title={REQUISITIONS_KIT_COPY.nothingWaiting.title} description={HISTORY_COPY.empty} />
          ) : (
            <ul className="border border-wds-border bg-wds-surface">
              {data.rows.map((row) => (
                <HistoryRow key={row.requisitionId} row={row} />
              ))}
            </ul>
          )}
          <div className="grow" />
          {data && total > 0 ? (
            <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pb-5 pt-3">
              <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary" aria-live="polite">
                {HISTORY_COPY.showing((page - 1) * PAGE_SIZE + 1, Math.min(total, (page - 1) * PAGE_SIZE + data.rows.length), total)}
              </p>
              {pages > 1 ? <PageButtons page={page} pages={pages} onPage={(p) => setQuery({ page: p === 1 ? null : String(p) })} /> : null}
            </nav>
          ) : null}
        </div>
      </div>
    </PhoneColumn>
  );
}

function HistoryRow({ row }: { row: HistoryMineRow }) {
  const cycle = row.cycleLabel.split(' · ')[0] ?? row.cycleLabel;
  const cancelled = row.status === 'CANCELLED';
  const second = cancelled
    ? HISTORY_COPY.cancelledOn(row.cancelledAt ? shortDateText(row.cancelledAt) : '', cancelReasonText(row.cancelReason))
    : row.sentAt
      ? HISTORY_COPY.sentOn(dateTimeText(row.sentAt))
      : HISTORY_COPY.notSent;
  return (
    <li className="border-b border-wds-border last:border-b-0">
      <Link href={reqFile(row.requisitionId)} className="flex items-center gap-2.5 px-3.5 py-3 outline-none transition-colors duration-100 hover:bg-wds-neutral-50 active:bg-wds-neutral-100 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]">
        <div className="flex min-w-0 grow basis-0 flex-col gap-[3px]">
          <span className="font-wds-mono text-[13px] leading-4 text-[#1F5BAE] underline underline-offset-2">{row.reference}</span>
          <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">
            {cycle} · {row.lineCount} {row.lineCount === 1 ? 'line' : 'lines'}
          </span>
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{second}</span>
        </div>
        <StatusChip status={row.status} text={row.statusText} plain />
      </Link>
    </li>
  );
}

/** ‹ 1 2 3 ›: the current page is dark, an arrow that cannot be used is grey. */
function PageButtons({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const numbers = Array.from({ length: Math.min(pages, 5) }, (_, i) => {
    const start = Math.min(Math.max(1, page - 2), Math.max(1, pages - 4));
    return start + i;
  });
  const box =
    'flex size-11 shrink-0 items-center justify-center border font-wds-sans text-[12px] leading-4 outline-none transition-colors duration-100 focus-visible:shadow-wds-ring enabled:hover:bg-wds-neutral-100 enabled:active:bg-wds-neutral-200 disabled:cursor-not-allowed';
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className={cn(box, 'border-wds-border-strong bg-wds-surface text-wds-text-ink disabled:text-wds-text-faint')}>
        ‹
      </button>
      {numbers.map((n) => (
        <button key={n} type="button" aria-label={`Page ${n}`} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)} className={cn(box, n === page ? 'border-wds-text-ink bg-wds-text-ink text-wds-surface' : 'border-wds-border-strong bg-wds-surface text-wds-text-ink')}>
          {n}
        </button>
      ))}
      <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className={cn(box, 'border-wds-border-strong bg-wds-surface text-wds-text-ink disabled:text-wds-text-faint')}>
        ›
      </button>
    </div>
  );
}
