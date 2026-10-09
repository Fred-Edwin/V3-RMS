'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { DateRangePicker } from '@/components/ui2/date-range-picker';
import { useAuthStore } from '@/store/authStore';
import { PhoneColumn, ScwPhoneHeader } from '../../../_shared/components/phone-column';
import { ListSkeleton, OutlineChip, PagerBar } from '../../../_shared/components/block2-phone-parts';
import { PhoneFilterSelect } from '../../../_shared/components/phone-filter-select';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { useLoader } from '../../../_shared/hooks/use-async';
import { usePhoneListParams } from '../../../_shared/hooks/use-phone-list-params';
import { PHONE_FILTER_HIT } from '../../../_shared/lib/phone-styles';
import { itemsLabel } from '../../_shared/lib/count-format';
import { COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import type { MyCountRow, MyCountsQuery } from '../../_shared/types/counting-contract';

const COUNTS = '/app/inventory/stock/counts';
/** Paper step 53 draws five rows and "Showing 1 to 5 of 12" as a sample page; the contract's smallest page size is 25 (`PageQuery`). */
const PAGE_SIZE = 25;
const STATUSES = [
  { value: 'waiting', label: 'Waiting for review' },
  { value: 'approved', label: 'Approved' },
] as const;

/** "Wed 7 Oct 07:42" → "Wed 7 Oct · 07:42", as Paper draws the signed line. */
const signedLine = (text: string): string => `Signed ${text.replace(/\s(\d\d:\d\d)$/, ' · $1')}`;

function CountRow({ row }: { row: MyCountRow }) {
  return (
    <li className="flex items-center gap-2.5 border-b border-wds-neutral-100 px-3.5 py-3 last:border-b-0">
      <div className="flex min-w-0 grow basis-0 flex-col gap-[3px]">
        <Link href={`${COUNTS}/${row.id}/submitted`} className="-my-1.5 w-fit py-1.5 font-wds-mono text-[13px] leading-4 text-[#1F5BAE] underline underline-offset-2 outline-none focus-visible:shadow-wds-ring">
          {row.reference}
        </Link>
        <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">
          {row.sectionsText} · {itemsLabel(row.itemCount)}
        </span>
        <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{signedLine(row.signedText)}</span>
      </div>
      <OutlineChip tone={row.status === 'SUBMITTED' ? 'warning' : 'success'}>{row.statusText}</OutlineChip>
    </li>
  );
}

/**
 * My counts (Paper step 53): every count the person has signed, newest first, as a phone list. Date range, status and page live in
 * the URL. Reads C32, which is blind: a status and a number of items, never a difference. No search (Paper draws none).
 */
export function MyCountsScreen() {
  const router = useRouter();
  const userName = useAuthStore((s) => s.user?.name ?? '');
  const { today, range, page, params, setQuery } = usePhoneListParams('last30');
  const status = STATUSES.find((s) => s.value === params.get('status'))?.value;
  const query: MyCountsQuery = { from: range.from, to: range.to, status: status ?? 'all', page, pageSize: PAGE_SIZE };
  const key = `my-counts:${range.from}:${range.to}:${status ?? 'all'}:${page}`;
  const load = useLoader(key, () => countingApi.mine(query), COUNTING_STATES_COPY.myCounts.error);
  const data = load.data;
  const total = data?.page.total;
  const subtitle = [total === undefined ? null : `${total} ${total === 1 ? 'count' : 'counts'}`, userName].filter(Boolean).join(' · ');

  let body: React.ReactNode;
  if (load.status === 'error' && !data) {
    body = <ScwStatePanel kind="error" phone text={COUNTING_STATES_COPY.myCounts.error} onRetry={() => void load.reload()} />;
  } else if (!data) {
    body = (
      <>
        <LoadingAnnouncer text={COUNTING_STATES_COPY.myCounts.loading} />
        <ListSkeleton rows={5} />
      </>
    );
  } else if (data.rows.length === 0) {
    body = <ScwStatePanel kind="empty" phone text={COUNTING_STATES_COPY.myCounts.empty} actionLabel="Pick a section" onAction={() => router.push(`${COUNTS}/sections`)} />;
  } else {
    body = (
      <ul className="border border-wds-border bg-wds-surface">
        {data.rows.map((row) => (
          <CountRow key={row.id} row={row} />
        ))}
      </ul>
    );
  }

  return (
    <PhoneColumn>
      <ScwPhoneHeader leading="back" onBack={() => router.push(COUNTS)} title="My counts" subtitle={subtitle} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            label="Date"
            showLabel
            today={today}
            value={range}
            onChange={(r) => setQuery({ from: r?.from ?? null, to: r?.to ?? null })}
            note="Later dates can’t be picked. Counts are listed by the day they were signed."
            buttonClassName={`h-[34px] max-sm:h-[34px] rounded-none px-3 font-wds-sans text-[13px] leading-4 ${PHONE_FILTER_HIT}`}
          />
          <PhoneFilterSelect label="Status" options={STATUSES} value={status} onChange={(value) => setQuery({ status: value ?? null })} />
        </div>
        <div className="mt-3 flex flex-col">{body}</div>
        <div className="grow" />
        {data && data.page.total > 0 ? (
          <PagerBar page={page} pageSize={PAGE_SIZE} total={data.page.total} shown={data.rows.length} onPage={(p) => setQuery({ page: p === 1 ? null : String(p) })} noun="" />
        ) : null}
      </div>
    </PhoneColumn>
  );
}
