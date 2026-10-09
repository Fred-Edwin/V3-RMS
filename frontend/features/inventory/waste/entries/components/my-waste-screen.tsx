'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { DateRangePicker } from '@/components/ui2/date-range-picker';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/authStore';
import { PhoneColumn, ScwPhoneHeader } from '../../../_shared/components/phone-column';
import { ListSkeleton, PagerBar } from '../../../_shared/components/block2-phone-parts';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { useLoader } from '../../../_shared/hooks/use-async';
import { usePhoneListParams } from '../../../_shared/hooks/use-phone-list-params';
import { PHONE_FILTER_HIT, PHONE_PRIMARY_BUTTON } from '../../../_shared/lib/phone-styles';
import { clockLabel, todayLabel } from '../../../counting/_shared/lib/count-format';
import { ReversePhoneSheet } from '../../reverse/components/reverse-dialogs';
import { WASTE_STATES_COPY } from '../../_shared/lib/states-copy';
import { wasteApi } from '../../_shared/services/waste-api';
import type { WasteEntry, WasteList } from '../../_shared/types/waste-contract';

const WASTE = '/app/inventory/stock/waste';
const COUNTS = '/app/inventory/stock/counts';
const PAGE_SIZE = 50;
const NAIROBI = 'Africa/Nairobi';
const dayKey = (iso: string): string => new Intl.DateTimeFormat('en-CA', { timeZone: NAIROBI }).format(new Date(iso));
/** "Thu 8 Oct", the way the Paper group headings read. */
const dayHeading = (iso: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso)).replace(',', '');

interface DayGroup {
  day: string;
  heading: string;
  rows: WasteEntry[];
}

/** Groups the page's rows (already newest first) by the Nairobi day they were logged, keeping order. */
function groupByDay(rows: readonly WasteEntry[], today: string): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const row of rows) {
    const day = dayKey(row.at);
    let group = groups[groups.length - 1];
    if (!group || group.day !== day) {
      group = { day, heading: `${day === today ? 'Today · ' : ''}${dayHeading(row.at)}`, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

function EntryRow({ entry, onReverse }: { entry: WasteEntry; onReverse: (e: WasteEntry) => void }) {
  const reversed = entry.status === 'REVERSED';
  return (
    <li className="flex min-h-[62px] items-center justify-between gap-3 border-b border-wds-neutral-100 px-3.5 py-2 last:border-b-0">
      <span className="flex min-w-0 flex-col">
        <span className={cn('truncate font-wds-sans text-[15px] leading-[18px]', reversed ? 'text-wds-text-copy-faint line-through' : 'text-wds-text-ink')}>{entry.itemName}</span>
        <span className={cn('font-wds-sans text-[12px] leading-4', reversed ? 'text-wds-text-copy-faint' : 'text-wds-text-secondary')}>
          {entry.quantity} {entry.unit} · {entry.reasonText} · {clockLabel(entry.at)}
        </span>
      </span>
      {reversed && entry.reversal ? (
        <span className="shrink-0 border border-wds-border-strong bg-wds-neutral-100 px-2 py-0.5 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Reversed {clockLabel(entry.reversal.at)}</span>
      ) : entry.can.reverse ? (
        <button
          type="button"
          onClick={() => onReverse(entry)}
          className={cn(PHONE_FILTER_HIT, 'h-[34px] shrink-0 border border-wds-border-strong bg-wds-surface px-3.5 font-wds-sans text-[13px] leading-4 text-wds-text-ink outline-none transition-[background-color,transform] hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring motion-safe:active:scale-[0.97]')}
        >
          Reverse<span className="sr-only"> {entry.itemName}</span>
        </button>
      ) : null}
    </li>
  );
}

/**
 * My waste, today and earlier (Paper step 54): the person's own entries over a date range (starting at the last 7 days), grouped by
 * the Nairobi day they were logged. Reverse shows only where the server says `can.reverse` (their own entry, the day they logged it);
 * a reversed entry is struck through. No stock figures and no money. Date range and page live in the URL.
 */
export function MyWasteScreen() {
  const router = useRouter();
  const userName = useAuthStore((s) => s.user?.name ?? '');
  const { today, range, page, setQuery } = usePhoneListParams('last7');
  const key = `my-waste:${range.from}:${range.to}:${page}`;
  const load = useLoader<WasteList>(key, () => wasteApi.list({ scope: 'mine', from: range.from, to: range.to, page, pageSize: PAGE_SIZE }), WASTE_STATES_COPY.myWasteEarlier.error);
  const [reversing, setReversing] = React.useState<WasteEntry | null>(null);
  const [notice, setNotice] = React.useState('');
  const { data, setData } = load;
  const groups = React.useMemo(() => (data ? groupByDay(data.rows, today) : []), [data, today]);

  let body: React.ReactNode;
  if (load.status === 'error' && !data) {
    body = <ScwStatePanel kind="error" phone text={WASTE_STATES_COPY.myWasteEarlier.error} onRetry={() => void load.reload()} />;
  } else if (!data) {
    body = (
      <>
        <LoadingAnnouncer text={WASTE_STATES_COPY.myWasteEarlier.loading} />
        <ListSkeleton rows={4} />
      </>
    );
  } else if (data.rows.length === 0) {
    body = <ScwStatePanel kind="empty" phone text={WASTE_STATES_COPY.myWasteEarlier.empty} actionLabel="Log waste" onAction={() => router.push(`${WASTE}/new`)} />;
  } else {
    body = (
      <>
        {groups.map((group) => (
          <section key={group.day} aria-label={group.heading} className="flex flex-col gap-3">
            <h2 className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
              {group.heading} · {group.rows.length} {group.rows.length === 1 ? 'entry' : 'entries'}
            </h2>
            <ul className="border border-wds-border bg-wds-surface">
              {group.rows.map((entry) => (
                <EntryRow key={entry.id} entry={entry} onReverse={setReversing} />
              ))}
            </ul>
          </section>
        ))}
        <p className="border border-wds-info-border bg-wds-info-bg px-3 py-2.5 font-wds-sans text-[12px] leading-4 text-wds-info-fg">
          You can reverse your own entries on the day you logged them. For an earlier day, ask the Store Manager.
        </p>
      </>
    );
  }

  return (
    <PhoneColumn>
      <ScwPhoneHeader leading="back" onBack={() => router.push(COUNTS)} title="My waste" subtitle={`${todayLabel()} · ${userName}`} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            label="Date"
            showLabel
            today={today}
            value={range}
            onChange={(r) => setQuery({ from: r?.from ?? null, to: r?.to ?? null })}
            note="Later dates can’t be picked. Entries are listed by the day they were logged."
            buttonClassName={`h-[34px] max-sm:h-[34px] rounded-none px-3 font-wds-sans text-[13px] leading-4 ${PHONE_FILTER_HIT}`}
          />
        </div>
        {body}
        <div className="grow" />
        {data && data.page.total > PAGE_SIZE ? (
          <PagerBar page={page} pageSize={PAGE_SIZE} total={data.page.total} shown={data.rows.length} onPage={(p) => setQuery({ page: p === 1 ? null : String(p) })} noun="entries" />
        ) : null}
        <p role="status" aria-live="polite" className="sr-only">{notice}</p>
      </div>
      <div className="shrink-0 px-4 pb-5 pt-3">
        <Link href={`${WASTE}/new`} className={cn(PHONE_PRIMARY_BUTTON, 'h-[50px] text-[16px] leading-5')}>Log more waste</Link>
      </div>
      <ReversePhoneSheet
        entry={reversing}
        onClose={() => setReversing(null)}
        onDone={(updated) => {
          setData((d) => (d ? { ...d, rows: d.rows.map((r) => (r.id === updated.id ? updated : r)) } : d));
          setReversing(null);
          setNotice(`${updated.itemName} reversed. The stock went back.`);
        }}
      />
    </PhoneColumn>
  );
}
