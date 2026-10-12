'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { B2Header } from '../../../_shared/components/block2-phone-parts';
import { useAttendantData } from '../../hooks/use-attendant';
import { MyOrderCard, NeedsYouRow, PURCHASING } from './order-cards';
import { Card, HeaderSearch, Label, LinkAction, PhoneEmpty, PhoneError, PhoneLoading, PhoneScreen, Pill, PrimaryButton, longDayLabel, withRole } from './phone-kit';

/** 28A: the Attendant's Purchasing home: what needs restocking, what needs them now, and their open orders. */
export function HomeScreen() {
  const router = useRouter();
  const { data, status, error, reload } = useAttendantData('attendant:home', (s) => s.getAttendantHome(), 'We could not load Purchasing.');
  const unread = data?.badges.unreadNotices ?? 0;

  return (
    <PhoneScreen
      header={
        <B2Header title="Purchasing" subtitle={data ? `${longDayLabel(data.today)} · Central Store` : 'Central Store'} leading="menu" place="HUB" bell={{ count: unread, onClick: () => router.push(`${PURCHASING}/notifications`) }}>
          <HeaderSearch placeholder="Search items, suppliers or LPO numbers" label="Search Purchasing" onOpen={() => router.push(`${PURCHASING}/search`)} />
        </B2Header>
      }
    >
      {status === 'loading' || status === 'idle' ? (
        <PhoneLoading rows={3} card label="Loading Purchasing" />
      ) : (
        <div className="flex flex-col gap-5 px-5 py-[18px]">
          {status === 'error' ? <PhoneError onRetry={() => void reload()} message={error} /> : null}
          {data ? (
            <>
              <Card className="flex flex-col gap-3.5 p-4">
                {data.restock.total === 0 ? (
                  <PhoneEmpty title="Nothing needs restocking" line="Every item is above its reorder level." action={{ label: 'Restock levels', href: `${PURCHASING}/levels` }} />
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-end gap-3">
                        <p className="font-wds-sans text-[44px] font-semibold leading-[44px] tracking-[-0.02em] text-wds-text-ink">{data.restock.total}</p>
                        <p className="w-24 pb-[3px] font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{data.restock.total === 1 ? 'item needs restocking' : 'items need restocking'}</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {data.restock.out > 0 ? (
                          <Pill tone="error" dot>
                            {data.restock.out} out
                          </Pill>
                        ) : null}
                        {data.restock.low > 0 ? (
                          <Pill tone="warning" dot>
                            {data.restock.low} low
                          </Pill>
                        ) : null}
                      </div>
                    </div>
                    <PrimaryButton size="list" href={`${PURCHASING}/restock`}>
                      Build the restock list
                    </PrimaryButton>
                    <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Amounts are filled in from your restock levels. {withRole(data.approver)} approves before anything is ordered.</p>
                  </>
                )}
              </Card>

              {data.needsYou.length > 0 ? (
                <section aria-labelledby="home-needs" className="flex flex-col gap-2">
                  <Label id="home-needs">NEEDS YOU NOW · {data.needsYou.length}</Label>
                  <Card>
                    <ul>
                      {data.needsYou.map((o) => (
                        <NeedsYouRow key={o.id} order={o} approver={data.approver} />
                      ))}
                    </ul>
                  </Card>
                </section>
              ) : null}

              <section aria-labelledby="home-orders" className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label id="home-orders">MY ORDERS · {data.myOrders.total} OPEN</Label>
                  {data.myOrders.total > 0 ? (
                    <LinkAction small href={`${PURCHASING}/my-orders`}>
                      See all
                    </LinkAction>
                  ) : null}
                </div>
                {data.myOrders.rows.length > 0 ? (
                  <ul className="flex flex-col gap-2.5">
                    {/* An order that needs me already sits in "Needs you now" above; showing it twice is noise. */}
                    {data.myOrders.rows
                      .filter((o) => !data.needsYou.some((n) => n.id === o.id))
                      .map((o) => (
                        <MyOrderCard key={o.id} order={o} approver={data.approver} />
                      ))}
                  </ul>
                ) : (
                  <Card>
                    <PhoneEmpty title="No open orders" line="Orders you raise show up here." action={{ label: 'Build restock list', href: `${PURCHASING}/restock` }} />
                  </Card>
                )}
              </section>
            </>
          ) : null}
        </div>
      )}
    </PhoneScreen>
  );
}
