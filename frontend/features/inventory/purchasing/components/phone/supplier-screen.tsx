'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { B2Header } from '../../../_shared/components/block2-phone-parts';
import { useAttendantData } from '../../hooks/use-attendant';
import { kes, qty } from '../../lib/format';
import { useRestockList } from '../../store/restock-list-store';
import type { SupplierItemRow } from '../../types/attendant';
import { PURCHASING, orderHref, receiveHref, refLine, statusLine } from './order-cards';
import { Card, HIT, Label, LinkAction, PhoneBar, PhoneEmpty, PhoneError, PhoneLoading, PhoneScreen, PrimaryButton, SecondaryButton, StatusLine, plural, useGoBack } from './phone-kit';

const digits = (value: string | null): string | null => {
  const d = value?.replace(/[^\d+]/g, '') ?? '';
  return d.length > 0 ? d : null;
};

/** The wa.me link needs the number with a country code and no plus. */
const whatsappHref = (value: string | null): string | null => {
  const d = digits(value)?.replace(/^\+/, '') ?? null;
  return d ? `https://wa.me/${d}` : null;
};

const CallButtons = ({ phone, whatsapp }: { phone: string | null; whatsapp: string | null }) => {
  const tel = digits(phone);
  const wa = whatsappHref(whatsapp ?? phone);
  const base = 'flex h-10 flex-1 items-center justify-center font-wds-sans text-[13px] font-medium leading-4 outline-none focus-visible:shadow-wds-ring';
  return (
    <div className="flex gap-2.5">
      {tel ? (
        <a href={`tel:${tel}`} className={cn(base, 'bg-white text-wds-text-ink')}>
          Call
        </a>
      ) : (
        <span aria-disabled="true" className={cn(base, 'bg-white text-wds-text-faint')}>
          No phone on file
        </span>
      )}
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(base, 'gap-2 bg-[#25D366] font-semibold text-[#06351B]')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06351B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 18.8L4 20z" />
            <path d="M9 9.5c.3 2.5 2.5 4.7 5 5l1.3-1.3-1.8-1-.8.6c-.7-.3-1.5-1.1-1.8-1.8l.6-.8-1-1.8L9 9.5z" />
          </svg>
          WhatsApp
        </a>
      ) : (
        <span aria-disabled="true" className={cn(base, 'bg-[#25D366]/40 font-semibold text-[#06351B]/60')}>
          No WhatsApp
        </span>
      )}
    </div>
  );
};

function ItemLine({ item }: { item: SupplierItemRow }) {
  const stock = item.onHand !== undefined ? qty(item.onHand) : null;
  return (
    <li className="flex items-center justify-between gap-3 border-b border-wds-border px-3.5 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{item.name}</p>
        {item.status === 'OUT' ? (
          <p className="font-wds-sans text-[11px] leading-[14px] text-wds-error-fg">Out of stock</p>
        ) : item.status === 'LOW' ? (
          <p className="font-wds-sans text-[11px] leading-[14px] text-wds-warning-fg">Low{stock !== null ? ` · ${stock} left` : ''}</p>
        ) : item.status === 'OK' ? (
          <p className="font-wds-sans text-[11px] leading-[14px] text-wds-success-fg">In stock{stock !== null ? ` · ${stock}` : ''}</p>
        ) : (
          <p className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">No reorder level set</p>
        )}
      </div>
      {item.price !== '' ? <p className="shrink-0 font-wds-mono text-[12px] leading-4 text-wds-text-secondary">KES {kes(item.price)}</p> : null}
    </li>
  );
}

/** 28M: one supplier: how to reach them, their open order, and the items we buy from them. */
export function SupplierScreen({ supplierId }: { supplierId: string }) {
  const back = useGoBack(PURCHASING);
  const list = useRestockList();
  const addToast = useWdsToastStore((s) => s.addToast);
  const [find, setFind] = React.useState('');
  const { data, status, error, reload } = useAttendantData(`attendant:supplier:${supplierId}`, (s) => s.getAttendantSupplier(supplierId), 'We could not load this supplier.');

  const items = React.useMemo(() => (data ? data.items.filter((i) => !find.trim() || i.name.toLowerCase().includes(find.trim().toLowerCase())) : []), [data, find]);
  const addable = data ? data.items.filter((i) => (i.status === 'OUT' || i.status === 'LOW') && !i.onOpenOrder) : [];
  // One entry per item, even if a supplier lists the same item twice.
  const toAdd = addable.filter((i, n) => !list.has(i.inventoryItemId) && addable.findIndex((o) => o.inventoryItemId === i.inventoryItemId) === n);
  const supplier = data?.supplier;
  const open = data?.openOrder ?? null;

  const addAll = (): void => {
    if (!supplier) return;
    for (const i of toAdd) list.add({ inventoryItemId: i.inventoryItemId, name: i.name, qty: i.suggestedQty ?? '1', buyUnit: i.buyUnit, supplierId: supplier.id, supplierName: supplier.name, unitPrice: i.price === '' ? null : i.price });
    addToast({ variant: 'success', title: `${plural(toAdd.length, 'item')} added to your list` });
  };

  const bar =
    data && addable.length > 0 ? (
      <PhoneBar>
        {toAdd.length > 0 ? (
          <PrimaryButton onClick={addAll}>Add {toAdd.length} low {toAdd.length === 1 ? 'item' : 'items'} to my list</PrimaryButton>
        ) : (
          <PrimaryButton href={`${PURCHASING}/restock/review`}>Review list ({list.count})</PrimaryButton>
        )}
      </PhoneBar>
    ) : undefined;

  return (
    <PhoneScreen
      header={
        <B2Header title={supplier?.name ?? 'Supplier'} subtitle={supplier ? [supplier.category, `${plural(data?.items.length ?? 0, 'item')} you buy from them`].filter(Boolean).join(' · ') : ' '} leading="back" onBack={back} place="HUB">
          {supplier ? <CallButtons phone={supplier.phone} whatsapp={supplier.whatsapp} /> : null}
        </B2Header>
      }
      bar={bar}
    >
      {status === 'loading' || status === 'idle' ? (
        <PhoneLoading rows={3} card label="Loading this supplier" />
      ) : (
        <div className="flex flex-col gap-4 px-5 py-4">
          {status === 'error' ? <PhoneError onRetry={() => void reload()} message={error} /> : null}
          {data && !open && data.items.length === 0 ? <PhoneEmpty title="No orders with this supplier" line="Add their items to your list to start." action={{ label: 'Build restock list', href: `${PURCHASING}/restock` }} /> : null}
          {open ? (
            <section aria-labelledby="sup-open" className="flex flex-col gap-2">
              <Label id="sup-open">OPEN ORDER · 1</Label>
              <Card className="flex items-center justify-between gap-3 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="font-wds-mono text-[12px] leading-4 text-wds-text-ink">
                    {open.reference ?? 'Draft'} · {kes(open.orderedTotal)}
                  </p>
                  <StatusLine tone="info" plain={false} className="text-wds-info-fg">
                    {statusLine(open, null).text.replace(/ · LPO-\d+/, '')}
                  </StatusLine>
                  <span className="sr-only">{refLine(open)}</span>
                </div>
                {open.status === 'SENT' ? (
                  <SecondaryButton size="inline" href={receiveHref(open.id)}>
                    Receive
                  </SecondaryButton>
                ) : (
                  <SecondaryButton size="inline" href={orderHref(open.id)}>
                    Open
                  </SecondaryButton>
                )}
              </Card>
            </section>
          ) : null}
          {data && data.items.length > 0 ? (
            <section aria-labelledby="sup-items" className="flex flex-col gap-2">
              <label className="flex h-10 items-center gap-2.5 border border-wds-border-strong bg-white px-3 focus-within:shadow-wds-ring">
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
                  <circle cx="11" cy="11" r="7" fill="none" stroke="#847E76" strokeWidth="2" />
                  <path d="M16.5 16.5L21 21" stroke="#847E76" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input type="search" aria-label="Search their items" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search their items" className="min-w-0 flex-1 bg-transparent font-wds-sans text-[13px] leading-4 text-wds-text-ink outline-none placeholder:text-wds-text-faint [&::-webkit-search-cancel-button]:hidden" />
              </label>
              <Label id="sup-items" className="pt-1">
                ITEMS WE BUY FROM THEM · {data.items.length}
              </Label>
              {items.length > 0 ? (
                <Card>
                  <ul>
                    {items.map((i, n) => (
                      <ItemLine key={`${i.inventoryItemId}-${n}`} item={i} />
                    ))}
                  </ul>
                </Card>
              ) : (
                <PhoneEmpty title={`No match for "${find.trim()}"`} line="Check the spelling." action={{ label: 'Clear search', onClick: () => setFind('') }} />
              )}
            </section>
          ) : null}
          {supplier ? (
            <LinkAction href={`${PURCHASING}/history?q=${encodeURIComponent(supplier.name)}`} className={cn(HIT, 'self-start')}>
              See all orders with {supplier.name} ›
            </LinkAction>
          ) : null}
        </div>
      )}
    </PhoneScreen>
  );
}
