'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';
import { nairobiToday, presetRange, type DatePreset } from '@/components/ui2/data-table/table-dates';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { PhoneFilterSelect } from '../../../_shared/components/phone-filter-select';
import { B2Header, Chip, PagerBar } from '../../../_shared/components/block2-phone-parts';
import { BRANCH_DAY_STATES_COPY, dayStatusChip } from '../../_shared/lib/branch-day-copy';
import type { MyHistoryQuery, MyHistoryRow } from '../../_shared/types/branch-day-contract';
import { useMyHistory } from '../hooks/use-phone-day';
import { dayText, plural, timeText } from '../lib/phone-format';
import { DAY_HOME, dayPast } from '../lib/phone-routes';
import { BodyState } from './phone-parts';
import { Skeleton } from '@/components/ui2/skeleton';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';

const DATE_OPTIONS = [
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
] as const;
const STATUS_OPTIONS = [
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CORRECTED', label: 'Corrected' },
] as const;
const PAGE_SIZE = 25;

const rowLine = (row: MyHistoryRow): string => (row.correctedCount > 0 ? `I signed at ${timeText(row.signedAt)} · ${plural(row.correctedCount, 'figure', 'figures')} corrected` : `I signed at ${timeText(row.signedAt)}`);

/** Paper step 19: my department's past days. Closed and corrected days, quantities only, no costs. Filters and page live in the address. */
export function PastDaysScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const orgName = useAuthStore((s) => s.user?.organizationName ?? '');
  const copy = BRANCH_DAY_STATES_COPY.myHistory;
  const [today] = React.useState(() => nairobiToday());

  const dateParam = params.get('date');
  const datePreset: Extract<DatePreset, 'last7' | 'last30' | 'any'> = dateParam === 'last7' || dateParam === 'any' ? dateParam : 'last30';
  const statusParam = params.get('status');
  const status = statusParam === 'CLOSED' || statusParam === 'CORRECTED' ? statusParam : undefined;
  const page = Math.max(1, Math.floor(Number(params.get('page') ?? '1')) || 1);

  const setQuery = (patch: Record<string, string | null>): void => {
    const next = new URLSearchParams(params.toString());
    if (!('page' in patch)) next.delete('page');
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const range = datePreset === 'any' ? null : presetRange(datePreset, today);
  const query: MyHistoryQuery = { page, pageSize: PAGE_SIZE, ...(range ? { from: range.from, to: range.to } : {}), ...(status ? { status } : {}) };
  const { data, status: loadStatus, error, reload } = useMyHistory(query);
  const filtered = datePreset !== 'last30' || status !== undefined;

  return (
    <PhoneColumn>
      <B2Header title="Past days" subtitle={data ? `${data.department.name}${data.head ? ` · ${data.head.name}` : ''}` : ''} tall leading="back" onBack={() => router.push(DAY_HOME)} place={orgName} />
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-wds-canvas p-4">
        <div className="flex gap-2">
          <PhoneFilterSelect label="Date" allLabel="Any time" options={DATE_OPTIONS} value={datePreset === 'any' ? undefined : datePreset} onChange={(v) => setQuery({ date: v ?? 'any' })} />
          <PhoneFilterSelect label="Status" options={STATUS_OPTIONS} value={status} onChange={(v) => setQuery({ status: v ?? null })} />
        </div>
        {loadStatus === 'loading' || loadStatus === 'idle' ? (
          <div className="border border-wds-border bg-wds-surface" aria-busy="true">
            <LoadingAnnouncer text={copy.loading} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="flex items-center justify-between gap-2.5 border-b border-wds-neutral-100 px-3.5 py-3 last:border-b-0">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : loadStatus === 'error' || !data ? (
          <BodyState inMain kind="error" text={error ?? copy.error} onRetry={() => void reload()} />
        ) : data.rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 border border-wds-border bg-wds-surface px-6 py-12 text-center">
            <p className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">{filtered ? 'No days match' : 'No closed days yet'}</p>
            <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{filtered ? 'Change the dates or the status to see more.' : (copy.empty ?? '')}</p>
            {filtered ? (
              <button type="button" onClick={() => setQuery({ date: null, status: null })} className="mt-1 flex min-h-11 items-center font-wds-sans text-[13px] font-medium text-[var(--wds-primary-btn-start)] underline underline-offset-2 outline-none transition-opacity duration-100 ease-out focus-visible:shadow-wds-ring active:opacity-60">
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <ul aria-label="Past days" className="border border-wds-border bg-wds-surface">
              {data.rows.map((row) => (
                <li key={row.id} className="border-b border-wds-neutral-100 last:border-b-0">
                  <Link href={dayPast(row.id)} className="flex min-h-11 items-center justify-between gap-2.5 px-3.5 py-3 outline-none transition-colors duration-150 ease-out focus-visible:shadow-[inset_0_0_0_2px_var(--wds-caramel-500)] active:bg-wds-neutral-100 [@media(hover:hover)]:hover:bg-wds-neutral-50">
                    <span className="flex min-w-0 flex-col gap-[3px]">
                      <span className="font-wds-mono text-[13px] leading-4 text-[#1F5BAE] underline underline-offset-2">{row.reference}</span>
                      <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">
                        {dayText(row.date)} · {plural(row.itemsCounted, 'item', 'items')} counted
                      </span>
                      <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{rowLine(row)}</span>
                    </span>
                    <Chip spec={{ text: dayStatusChip(row.status), tone: row.status === 'CORRECTED' ? 'warning' : 'success' }} />
                  </Link>
                </li>
              ))}
            </ul>
            {/* Paper pins the pager to the foot of the screen. */}
            <div className="mt-auto">
              <PagerBar page={data.page.page} pageSize={data.page.pageSize} total={data.page.total} shown={data.rows.length} onPage={(p) => setQuery({ page: String(p) })} noun="" />
            </div>
          </>
        )}
      </main>
    </PhoneColumn>
  );
}
