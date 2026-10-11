'use client';

import * as React from 'react';

import { B2Header } from '../../../_shared/components/block2-phone-parts';
import { useAttendantData } from '../../hooks/use-attendant';
import type { MyOrdersFilter } from '../../types/attendant';
import { NeedsYouCard, PURCHASING, WaitingCard } from './order-cards';
import { useUrlParams } from './gate';
import { FilterChips, HeaderLink, HeaderSearch, Label, PhoneEmpty, PhoneError, PhoneLoading, PhoneScreen, useDebouncedQuery, useGoBack } from './phone-kit';

const FILTERS: MyOrdersFilter[] = ['all', 'needs', 'waiting', 'overdue'];

/** 28F: the Attendant's open orders, split into what needs them and what waits on someone else. */
export function MyOrdersScreen() {
  const back = useGoBack(PURCHASING);
  const { params, set } = useUrlParams();
  const filter = (FILTERS.includes(params.get('filter') as MyOrdersFilter) ? params.get('filter') : 'all') as MyOrdersFilter;
  const q = (params.get('q') ?? '').trim();
  const [text, setText] = useDebouncedQuery(params.get('q') ?? '', (value) => set({ q: value.trim() || null }));
  const { data, status, error, reload } = useAttendantData(`attendant:my-orders:${filter}:${q}`, (s) => s.getMyOrders({ filter, q: q || undefined }), 'We could not load your orders.');
  const counts = data?.counts;
  const rows = (data?.needsYou.length ?? 0) + (data?.waitingOnOthers.length ?? 0);

  return (
    <PhoneScreen
      header={
        <B2Header title="My orders" subtitle={counts ? `${counts.all} open · ${counts.needs} ${counts.needs === 1 ? 'needs' : 'need'} you` : 'Your open orders'} leading="back" onBack={back} place="HUB" action={<HeaderLink href={`${PURCHASING}/history`}>History ›</HeaderLink>}>
          <HeaderSearch value={text} onChange={setText} placeholder="Search supplier, item or LPO" label="Search your orders" />
        </B2Header>
      }
    >
      <FilterChips
        label="Show"
        active={filter}
        onChange={(key) => set({ filter: key === 'all' ? null : key })}
        chips={[
          { key: 'all', label: 'All', count: counts?.all },
          { key: 'needs', label: 'Needs me', count: counts?.needs },
          { key: 'waiting', label: 'Waiting', count: counts?.waiting },
          { key: 'overdue', label: 'Overdue', count: counts?.overdue },
        ]}
      />
      {status === 'loading' || status === 'idle' ? (
        <PhoneLoading rows={3} card label="Loading your orders" />
      ) : (
        <div className="flex flex-col gap-2.5 px-5 py-3.5">
          {status === 'error' ? <PhoneError onRetry={() => void reload()} message={error} /> : null}
          {data && rows === 0 ? (
            q ? (
              <PhoneEmpty title={`No match for "${q}"`} line="Check the spelling or search a supplier." action={{ label: 'Clear search', onClick: () => { setText(''); set({ q: null }); } }} />
            ) : filter !== 'all' ? (
              <PhoneEmpty title="Nothing here" line="No orders match this filter." action={{ label: 'Show all', onClick: () => set({ filter: null }) }} />
            ) : (
              <PhoneEmpty title="No open orders" line="Orders you raise show up here." action={{ label: 'Build restock list', href: `${PURCHASING}/restock` }} />
            )
          ) : null}
          {data && data.needsYou.length > 0 ? (
            <section aria-labelledby="mo-needs" className="flex flex-col gap-2.5">
              <Label id="mo-needs">NEEDS YOU · {data.needsYou.length}</Label>
              <ul className="flex flex-col gap-2.5">
                {data.needsYou.map((o) => (
                  <NeedsYouCard key={o.id} order={o} />
                ))}
              </ul>
            </section>
          ) : null}
          {data && data.waitingOnOthers.length > 0 ? (
            <section aria-labelledby="mo-wait" className={`flex flex-col gap-2.5 ${data.needsYou.length > 0 ? 'pt-1' : ''}`}>
              <Label id="mo-wait">WAITING ON OTHERS · {data.waitingOnOthers.length}</Label>
              <ul className="flex flex-col gap-2.5">
                {data.waitingOnOthers.map((o) => (
                  <WaitingCard key={o.id} order={o} approver={data.approver} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </PhoneScreen>
  );
}
