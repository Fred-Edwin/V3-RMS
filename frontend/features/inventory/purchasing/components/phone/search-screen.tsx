'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { useAttendantData } from '../../hooks/use-attendant';
import { qty } from '../../lib/format';
import { useRestockList } from '../../store/restock-list-store';
import type { SearchItem, SearchView } from '../../types/attendant';
import { PURCHASING, orderHref } from './order-cards';
import { useUrlParams } from './gate';
import { FilterChips, HIT, Label, PhoneEmpty, PhoneError, PhoneLoading, PhoneScreen, StatusLine, shortDay, dayLabel, useDebouncedQuery, useGoBack } from './phone-kit';

type Scope = 'all' | 'items' | 'suppliers' | 'orders';
const SCOPES: Scope[] = ['all', 'items', 'suppliers', 'orders'];

const Chevron = () => (
  <span aria-hidden="true" className="shrink-0 font-wds-sans text-[16px] leading-[18px] text-wds-text-faint">
    ›
  </span>
);

function orderLine(o: SearchView['orders'][number]): string {
  switch (o.status) {
    case 'CLOSED':
      return `Paid · ${shortDay(o.closedOn)}`;
    case 'CANCELLED':
      return `Cancelled · ${shortDay(o.closedOn)}`;
    case 'SENT':
      return o.dueLabel === 'OVERDUE' ? 'Sent · overdue' : o.dueLabel === 'DUE_TODAY' ? 'Sent · delivery expected today' : o.expectedDate ? `Sent · delivery expected ${dayLabel(o.expectedDate)}` : 'Sent';
    case 'AWAITING_APPROVAL':
      return 'Waiting for approval';
    case 'APPROVED':
      return 'Approved · ready to send';
    case 'RETURNED':
      return 'Sent back · edit and resend';
    case 'DELIVERED':
    case 'INVOICED':
      return 'Delivered';
    default:
      return 'Draft';
  }
}

function ItemResult({ item, list }: { item: SearchItem; list: ReturnType<typeof useRestockList> }) {
  const onList = list.get(item.inventoryItemId);
  const stock = item.onHand !== undefined ? qty(item.onHand) : null;
  let line: React.ReactNode;
  if (item.status === 'OUT' || item.status === 'LOW') {
    const base = item.status === 'OUT' ? `${stock ?? '0'} left` : stock !== null ? `${stock} left` : 'Running low';
    line = (
      <StatusLine tone={item.status === 'OUT' ? 'error' : 'warning'}>
        {base}
        {onList ? ` · on your list: ${qty(onList.qty)} ${onList.buyUnit}` : item.onOpenOrder ? ` · on ${item.onOpenOrder.reference ?? 'an open order'}` : ''}
      </StatusLine>
    );
  } else if (item.status === 'OK') {
    line = (
      <StatusLine tone="success" plain>
        {stock !== null ? `${stock} in stock · fine for now` : 'In stock · fine for now'}
      </StatusLine>
    );
  } else {
    line = (
      <StatusLine tone="muted" plain>
        No reorder level set
      </StatusLine>
    );
  }
  return (
    <li className="flex items-center justify-between gap-3 border-b border-wds-border bg-white px-5 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{item.name}</p>
        {line}
      </div>
      {onList ? (
        <span className="shrink-0 font-wds-sans text-[12px] leading-4 text-wds-success-fg">Added</span>
      ) : (
        <button
          type="button"
          aria-label={`Add ${item.name} to your list`}
          onClick={() => list.add({ inventoryItemId: item.inventoryItemId, name: item.name, qty: item.suggestedQty ?? '1', buyUnit: item.buyUnit, supplierId: item.supplier?.id ?? null, supplierName: item.supplier?.name ?? null, unitPrice: null })}
          className={cn(HIT, 'flex h-[30px] shrink-0 items-center border border-wds-border-strong bg-white px-3 font-wds-sans text-[12px] font-medium leading-4 text-wds-text-ink outline-none focus-visible:shadow-wds-ring [@media(hover:hover)]:hover:bg-wds-neutral-50')}
        >
          + Add
        </button>
      )}
    </li>
  );
}

/** 28E: search finds an item, a supplier or an order from one box. */
export function SearchScreen() {
  const back = useGoBack(PURCHASING);
  const { params, set } = useUrlParams();
  const list = useRestockList();
  const scope = (SCOPES.includes(params.get('scope') as Scope) ? params.get('scope') : 'all') as Scope;
  const q = (params.get('q') ?? '').trim();
  const [text, setText] = useDebouncedQuery(params.get('q') ?? '', (value) => set({ q: value.trim() || null }));
  const { data, status, error, reload } = useAttendantData(q.length > 0 ? `attendant:search:${q}` : null, (s) => s.searchAttendant(q.slice(0, 60)), 'We could not search.');
  const counts = data?.counts;
  const total = counts ? counts.items + counts.suppliers + counts.orders : 0;

  return (
    <PhoneScreen
      header={
        <header className="flex shrink-0 items-center gap-3 bg-wds-sidebar-top px-4 pb-4 pt-4">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[2px] border-2 border-wds-caramel-500 bg-white px-3.5">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
              <circle cx="11" cy="11" r="7" fill="none" stroke="#2E2B27" strokeWidth="2" />
              <path d="M16.5 16.5L21 21" stroke="#2E2B27" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              autoFocus
              type="search"
              aria-label="Search Purchasing"
              value={text}
              maxLength={60}
              onChange={(e) => setText(e.target.value)}
              placeholder="Search items, suppliers or LPO numbers"
              className="min-w-0 flex-1 bg-transparent font-wds-sans text-[15px] leading-5 text-wds-text-ink outline-none placeholder:text-wds-text-faint [&::-webkit-search-cancel-button]:hidden"
            />
            {text ? (
              <button type="button" aria-label="Clear search" onClick={() => { setText(''); set({ q: null }); }} className={cn(HIT, 'flex size-[18px] shrink-0 items-center justify-center rounded-[2px] bg-wds-neutral-200 font-wds-sans text-[12px] leading-[14px] text-wds-neutral-700 outline-none focus-visible:shadow-wds-ring')}>
                ×
              </button>
            ) : null}
          </label>
          <button type="button" onClick={back} className="flex min-h-11 shrink-0 items-center font-wds-sans text-[14px] leading-[18px] text-wds-caramel-300 outline-none focus-visible:shadow-wds-ring">
            Cancel
          </button>
        </header>
      }
    >
      {q.length > 0 ? (
        <FilterChips
          label="Show"
          active={scope}
          onChange={(key) => set({ scope: key === 'all' ? null : key })}
          chips={[
            { key: 'all', label: 'All', count: total },
            { key: 'items', label: 'Items', count: counts?.items ?? 0 },
            { key: 'suppliers', label: 'Suppliers', count: counts?.suppliers ?? 0 },
            { key: 'orders', label: 'Orders', count: counts?.orders ?? 0 },
          ]}
        />
      ) : null}
      {q.length === 0 ? (
        <PhoneEmpty title="Search Purchasing" line="Type an item, a supplier or an LPO number." />
      ) : status === 'loading' || status === 'idle' ? (
        <PhoneLoading rows={5} label="Searching" />
      ) : (
        <>
          {status === 'error' ? <PhoneError className="m-5" onRetry={() => void reload()} message={error} /> : null}
          {data && total === 0 ? <PhoneEmpty title={`No match for "${q}"`} line="Check the spelling or search a supplier." action={{ label: 'Clear search', onClick: () => { setText(''); set({ q: null }); } }} /> : null}
          {data && (scope === 'all' || scope === 'items') && data.items.length > 0 ? (
            <section aria-labelledby="s-items">
              <div className="px-5 pb-2 pt-3.5">
                <Label id="s-items">ITEMS</Label>
              </div>
              <ul className="border-t border-wds-border">
                {data.items.map((item) => (
                  <ItemResult key={item.inventoryItemId} item={item} list={list} />
                ))}
              </ul>
            </section>
          ) : null}
          {data && (scope === 'all' || scope === 'suppliers') && data.suppliers.length > 0 ? (
            <section aria-labelledby="s-sup">
              <div className="px-5 pb-2 pt-4">
                <Label id="s-sup">SUPPLIERS</Label>
              </div>
              <ul className="border-t border-wds-border">
                {data.suppliers.map((s) => (
                  <li key={s.id} className="border-b border-wds-border bg-white">
                    <Link href={`${PURCHASING}/suppliers/${s.id}`} className="flex items-center justify-between gap-3 px-5 py-3 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--wds-caramel-500)]">
                      <div className="min-w-0">
                        <p className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{s.name}</p>
                        <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                          {s.openOrderCount} open {s.openOrderCount === 1 ? 'order' : 'orders'} · {s.itemCount} {s.itemCount === 1 ? 'item' : 'items'} you buy from them
                        </p>
                      </div>
                      <Chevron />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {data && (scope === 'all' || scope === 'orders') && data.orders.length > 0 ? (
            <section aria-labelledby="s-orders">
              <div className="px-5 pb-2 pt-4">
                <Label id="s-orders">ORDERS</Label>
              </div>
              <ul className="border-t border-wds-border">
                {data.orders.map((o) => (
                  <li key={o.id} className="border-b border-wds-border bg-white">
                    <Link href={orderHref(o.id)} className="flex items-center justify-between gap-3 px-5 py-3 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--wds-caramel-500)]">
                      <div className="min-w-0">
                        <p className="truncate font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">
                          {o.reference ?? 'Draft'} · {o.supplier.name}
                        </p>
                        <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{orderLine(o)}</p>
                      </div>
                      <Chevron />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </PhoneScreen>
  );
}
