'use client';

import * as React from 'react';
import Link from 'next/link';

import { DateRangePicker, presetLabel } from '@/components/ui2/date-range-picker';
import { cn } from '@/lib/cn';
import { B2Header, PagerBar } from '../../../_shared/components/block2-phone-parts';
import { PhoneFilterSelect } from '../../../_shared/components/phone-filter-select';
import { usePhoneListParams } from '../../../_shared/hooks/use-phone-list-params';
import { useAttendantData } from '../../hooks/use-attendant';
import { kes } from '../../lib/format';
import type { HistoryRow, HistoryStatus } from '../../types/attendant';
import { PURCHASING, orderHref } from './order-cards';
import { HeaderSearch, Label, PhoneEmpty, PhoneError, PhoneLoading, PhoneScreen, plural, shortDay, useDebouncedQuery, useGoBack } from './phone-kit';

const PAGE_SIZE = 20;
const STATUSES: HistoryStatus[] = ['all', 'paid', 'cancelled'];

function Row({ row }: { row: HistoryRow }) {
  const cancelled = row.outcome === 'CANCELLED';
  return (
    <li className="border-b border-wds-border bg-white first:border-t">
      <Link href={orderHref(row.id)} className="flex items-center gap-3 px-5 py-3 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--wds-caramel-500)]">
        <div className="min-w-0 flex-1">
          <p className="truncate font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{row.supplier.name}</p>
          <p className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">
            {[row.reference ?? 'Draft', plural(row.itemCount, 'item'), row.shortCount > 0 ? `${row.shortCount} short` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-[3px]">
          {row.value !== '' ? <p className={cn('font-wds-mono text-[14px] leading-[18px]', cancelled ? 'text-wds-text-secondary' : 'text-wds-text-ink')}>{kes(row.value)}</p> : null}
          <p className={cn('font-wds-sans text-[11px] leading-[14px]', cancelled ? 'text-wds-error-fg' : 'text-wds-success-fg')}>
            {cancelled ? (row.cancelReason === 'WITHDRAWN' ? 'Withdrawn' : 'Cancelled') : 'Paid'} · {shortDay(row.closedOn)}
          </p>
        </div>
        <span aria-hidden="true" className="shrink-0 font-wds-sans text-[16px] leading-5 text-wds-text-faint">
          ›
        </span>
      </Link>
    </li>
  );
}

/** 28G (and the date sheet, 28G2): every closed or cancelled order, newest first, by month. */
export function HistoryScreen() {
  const back = useGoBack(PURCHASING, { parent: true });
  const { today, range, page, params, setQuery } = usePhoneListParams('last30');
  const status = (STATUSES.includes(params.get('status') as HistoryStatus) ? params.get('status') : 'all') as HistoryStatus;
  const q = (params.get('q') ?? '').trim();
  const [text, setText] = useDebouncedQuery(params.get('q') ?? '', (value) => setQuery({ q: value.trim() || null }));
  const { data, status: load, error, reload } = useAttendantData(`attendant:history:${range.from}:${range.to}:${status}:${q}:${page}`, (s) => s.getHistory({ from: range.from, to: range.to, status, q: q || undefined, page, pageSize: PAGE_SIZE }), 'We could not load your history.');
  const rows = data ? data.months.reduce((n, m) => n + m.rows.length, 0) : 0;

  return (
    <PhoneScreen
      header={
        <B2Header title="History" subtitle={data ? data.summary.allTime === data.summary.inRange ? plural(data.summary.allTime, 'order') : `${plural(data.summary.allTime, 'order')} · ${presetLabel(range, today)}: ${data.summary.inRange}` : 'Closed and cancelled orders'} leading="back" onBack={back} place="HUB">
          <HeaderSearch value={text} onChange={setText} placeholder="Search supplier, item or LPO" label="Search your history" />
        </B2Header>
      }
      bar={data && data.total > PAGE_SIZE ? <PagerBar bar page={data.page} pageSize={data.pageSize} total={data.total} shown={rows} onPage={(p) => setQuery({ page: p === 1 ? null : String(p) })} noun="" /> : undefined}
    >
      <div className="flex shrink-0 gap-2 bg-wds-canvas px-5 py-3">
        <div id="history-date">
          <DateRangePicker sheet showLabel label="Date" value={range} today={today} onChange={(r) => r && setQuery({ from: r.from, to: r.to })} buttonClassName="h-[34px] max-sm:h-[34px]" />
        </div>
        <PhoneFilterSelect
          label="Status"
          options={[
            { value: 'paid', label: 'Paid' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          value={status === 'all' ? undefined : status}
          onChange={(v) => setQuery({ status: v ?? null })}
        />
      </div>
      {load === 'loading' || load === 'idle' ? (
        <PhoneLoading rows={5} label="Loading your history" />
      ) : (
        <>
          {load === 'error' ? <PhoneError className="mx-5 mb-3" onRetry={() => void reload()} message={error} /> : null}
          {data && rows === 0 ? (
            q ? (
              <PhoneEmpty title={`No match for "${q}"`} line="Check the spelling or search a supplier." action={{ label: 'Clear search', onClick: () => { setText(''); setQuery({ q: null }); } }} />
            ) : (
              <PhoneEmpty title="No orders in this range" line="Try a longer date range." action={{ label: 'Change date', onClick: () => document.querySelector<HTMLButtonElement>('#history-date button')?.click() }} />
            )
          ) : null}
          {data?.months.map((m) => (
            <section key={m.key} aria-labelledby={`h-${m.key}`}>
              <div className="px-5 pb-2 pt-3.5">
                <Label id={`h-${m.key}`}>{m.label}</Label>
              </div>
              <ul>
                {m.rows.map((row) => (
                  <Row key={row.id} row={row} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </PhoneScreen>
  );
}
