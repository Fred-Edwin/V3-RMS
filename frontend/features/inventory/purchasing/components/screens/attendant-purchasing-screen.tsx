'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { PhoneErrorNote, PhoneHeader, PhonePrimaryButton, PhoneSuccessNote } from '../../../_shared/components/phone-parts';
import { StockEmptyCard, StockErrorCard } from '../../../_shared/components/stock-states';
import { useLoader } from '../../../_shared/hooks/use-async';
import { useMobileNavDrawer } from '../../../_shared/hooks/use-mobile-nav-drawer';
import { usePurchasing } from '../../hooks/use-purchasing';
import { PEOPLE } from '../../mock/fixtures';
import type { NeedsLine, NeedsRestocking, OrderRow } from '../../types';
import { PurchasingError } from '../../types';
import { DemoBanner } from '../demo-banner';

type Tab = 'restock' | 'receive' | 'orders';

const approver = PEOPLE.STORE_MANAGER.name.split(' ')[0] as string;

interface Pick {
  checked: boolean;
  qty: string;
  supplierId: string | null;
}

const pill = {
  green: 'border-wds-success-border bg-wds-success-bg text-wds-success-fg',
  amber: 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg',
  red: 'border-wds-error-border bg-wds-error-bg text-wds-error-fg',
  grey: 'border-wds-border bg-wds-neutral-50 text-wds-text-secondary',
} as const;

/** The status pill on a "My orders" card, with the words Paper `29` and `32` use. */
function statusOf(o: OrderRow): { text: string; tone: keyof typeof pill } {
  switch (o.status) {
    case 'DRAFT':
      return { text: 'Draft', tone: 'grey' };
    case 'AWAITING_APPROVAL':
      return { text: 'Awaiting approval', tone: 'amber' };
    case 'RETURNED':
      return { text: `Returned by ${o.returnedBy?.name.split(' ')[0] ?? approver}`, tone: 'red' };
    case 'APPROVED':
      return { text: 'Approved · ready to send', tone: 'green' };
    case 'SENT': {
      const d = o.dueInDays ?? 0;
      return o.dueLabel === 'OVERDUE' ? { text: `Sent · overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'}`, tone: 'red' } : o.dueLabel === 'DUE_TODAY' ? { text: 'Sent · due today', tone: 'amber' } : { text: `Sent · due in ${d} day${d === 1 ? '' : 's'}`, tone: 'grey' };
    }
    case 'CANCELLED':
      return { text: 'Cancelled', tone: 'grey' };
    default:
      return { text: 'Delivered', tone: 'green' };
  }
}

/**
 * The Store Attendant's Purchasing, on a phone (Paper `28` Restock, `29` My orders, `32` an order returned with a note; To receive
 * opens the receiving steps). The Attendant asks for stock: tick what is needed, set how much, add a note, and the request goes to the
 * Store Manager, who approves it. The Attendant sees no prices (decision Q-02), so quantities and statuses are shown without KES.
 */
export function AttendantPurchasingScreen() {
  const { service, data: tick, ready } = usePurchasing();
  const drawer = useMobileNavDrawer();
  const addToast = useWdsToastStore((s) => s.addToast);
  const [tab, setTab] = React.useState<Tab>('restock');
  const [search, setSearch] = React.useState('');
  const [picks, setPicks] = React.useState<Record<string, Pick>>({});
  const [note, setNote] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [problem, setProblem] = React.useState<{ message: string; openOrderId?: string } | null>(null);
  const [sent, setSent] = React.useState<string | null>(null);

  const needs = useLoader<NeedsRestocking>(ready ? 'att-needs' : null, () => service.getNeedsRestocking({}), 'We could not load what needs restocking.');
  const orders = useLoader<{ orders: OrderRow[]; total: number; valueTotal: string }>(ready ? 'att-orders' : null, () => service.listOrders({}), 'We could not load your orders.');
  const reloadNeeds = React.useRef(needs.reload);
  reloadNeeds.current = needs.reload;
  const reloadOrders = React.useRef(orders.reload);
  reloadOrders.current = orders.reload;
  React.useEffect(() => {
    void reloadNeeds.current();
    void reloadOrders.current();
  }, [tick, service]);

  const all = React.useMemo(() => (needs.data?.groups ?? []).flatMap((g) => g.lines), [needs.data]);
  const pickOf = (l: NeedsLine): Pick => picks[l.inventoryItemId] ?? { checked: false, qty: '', supplierId: l.chosenSupplierId };
  const setPick = (l: NeedsLine, patch: Partial<Pick>): void => setPicks((p) => ({ ...p, [l.inventoryItemId]: { ...pickOf(l), ...patch } }));

  const q = search.trim().toLowerCase();
  const visible = all.filter((l) => !q || l.itemName.toLowerCase().includes(q));
  const bySupplier = new Map<string, NeedsLine[]>();
  for (const l of visible) {
    const sid = pickOf(l).supplierId ?? '';
    bySupplier.set(sid, [...(bySupplier.get(sid) ?? []), l]);
  }
  const groups = Array.from(bySupplier.entries()).sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : 0));
  const supplierName = (id: string): string => needs.data?.suppliers.find((s) => s.id === id)?.name ?? all.flatMap((l) => l.supplierOptions).find((o) => o.supplierId === id)?.name ?? 'Supplier';
  const chosen = all.filter((l) => pickOf(l).checked && Number.parseFloat(pickOf(l).qty) > 0 && pickOf(l).supplierId);
  const chosenSuppliers = new Set(chosen.map((l) => pickOf(l).supplierId));

  const mine = orders.data?.orders ?? [];
  const toReceive = mine.filter((o) => o.stage === 'RECEIVE' && o.can.receive);
  const myOrders = mine.filter((o) => o.raisedBy.id === PEOPLE.STORE_ATTENDANT.id || o.raisedBy.role === 'Store Attendant').filter((o) => o.status !== 'CLOSED' && o.status !== 'CANCELLED');

  const send = async (): Promise<void> => {
    if (chosen.length === 0) return;
    setSending(true);
    setProblem(null);
    try {
      for (const sid of Array.from(chosenSuppliers)) {
        const lines = chosen.filter((l) => pickOf(l).supplierId === sid).map((l) => ({ inventoryItemId: l.inventoryItemId, qty: pickOf(l).qty, unitPrice: '' }));
        const draft = await service.createOrder({ supplierId: sid as string, expectedDate: null, supplierNote: null, attendantNote: note.trim() || null, lines });
        await service.submitOrder(draft.id);
      }
      setPicks({});
      setNote('');
      setSent(`${chosenSuppliers.size === 1 ? 'Your order has' : `${chosenSuppliers.size} orders have`} gone to ${approver} for approval.`);
      addToast({ variant: 'success', title: 'Sent for approval', description: `${approver} will approve it before it goes to the supplier.` });
      setTab('orders');
    } catch (e) {
      setProblem({ message: e instanceof Error ? e.message : 'We could not send the order. Try again.', openOrderId: e instanceof PurchasingError && e.code === 'SUPPLIER_ORDER_OPEN' ? String(e.details.openOrderId ?? '') : undefined });
    } finally {
      setSending(false);
    }
  };

  const mark = async (o: OrderRow, via: 'PRINT' | 'MANUAL'): Promise<void> => {
    try {
      if (via === 'PRINT') window.open(`/app/inventory/purchasing-print/${o.id}`, '_blank', 'noopener');
      await service.sendOrder(o.id, via);
      addToast({ variant: 'success', title: via === 'PRINT' ? 'Opened for printing' : 'Marked as sent', description: `${o.reference} is with ${o.supplier.name}.` });
    } catch (e) {
      addToast({ variant: 'error', title: 'We could not do that', description: e instanceof Error ? e.message : 'Try again.' });
    }
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col bg-wds-surface">
      <PhoneHeader title="Purchasing" subtitle="From what we need to what we have paid" leading="menu" onLeading={drawer.open} />
      <DemoBanner />
      <div role="tablist" aria-label="Purchasing" className="mx-4 mt-4 flex shrink-0 border border-wds-border-strong">
        {(
          [
            ['restock', `Restock · ${all.length}`],
            ['receive', `To receive · ${toReceive.length}`],
            ['orders', `My orders · ${myOrders.length}`],
          ] as const
        ).map(([k, label], i) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn('h-10 grow basis-0 font-wds-sans text-[13px] outline-none focus-visible:shadow-wds-ring', i > 0 && 'border-l border-wds-border-strong', tab === k ? 'bg-wds-espresso-50 font-medium text-wds-primary' : 'bg-wds-surface text-wds-neutral-800')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 grow flex-col overflow-y-auto">
        {tab === 'restock' ? (
          <div className="flex flex-col gap-3 p-4 pb-2">
            {sent ? <PhoneSuccessNote title="Sent for approval">{sent}</PhoneSuccessNote> : null}
            <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Tick what you need and set how much. The Store Manager approves before it goes to the supplier.</p>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search an item to add" aria-label="Search an item to add" className="h-11 border border-wds-border-strong bg-white px-3 font-wds-sans text-[14px] outline-none focus:shadow-wds-ring" />
            {needs.status === 'error' ? (
              <StockErrorCard title="We couldn't load the list" description={needs.error ?? 'Try again.'} onRetry={() => void needs.reload()} />
            ) : !needs.data ? (
              <div className="flex flex-col gap-3" aria-busy aria-label="Loading what needs restocking">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-24 animate-pulse bg-wds-neutral-100" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <StockEmptyCard title={all.length === 0 ? 'Nothing is low' : 'No item matches'} description={all.length === 0 ? 'Items that are low or out show here, ready to ask for.' : 'Try a different word.'} />
            ) : (
              groups.map(([sid, lines]) => (
                <section key={sid || 'none'} className="flex flex-col border border-wds-border" aria-label={sid ? supplierName(sid) : 'No supplier yet'}>
                  <div className={cn('flex items-center justify-between px-3.5 py-2.5', sid ? 'bg-wds-neutral-50' : 'border-b border-wds-warning-border bg-wds-warning-bg')}>
                    {sid ? (
                      <>
                        <h2 className="font-wds-sans text-[14px] font-semibold text-wds-neutral-950">{supplierName(sid)}</h2>
                        <span className="font-wds-sans text-[12px] text-wds-text-secondary">{lines.length} item{lines.length === 1 ? '' : 's'}</span>
                      </>
                    ) : (
                      <h2 className="font-wds-sans text-[14px] font-semibold text-wds-warning-fg">
                        No supplier yet <span className="ml-1.5 text-[12px] font-normal">Choose one for this item</span>
                      </h2>
                    )}
                  </div>
                  {lines.map((l) => {
                    const p = pickOf(l);
                    return (
                      <div key={l.inventoryItemId} className={cn('flex gap-3 border-t border-wds-border px-3.5 py-3', p.checked && 'bg-wds-espresso-50')}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={p.checked}
                          aria-label={`Ask for ${l.itemName}`}
                          disabled={!p.supplierId}
                          onClick={() => setPick(l, { checked: !p.checked, qty: !p.checked && !p.qty ? (l.suggestedQty ?? '1') : p.qty })}
                          className={cn('mt-0.5 flex size-[22px] shrink-0 items-center justify-center border-[1.5px] outline-none focus-visible:shadow-wds-ring disabled:opacity-40', p.checked ? 'border-wds-primary text-wds-primary' : 'border-wds-border-strong bg-white')}
                        >
                          {p.checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
                        </button>
                        <div className="flex min-w-0 grow flex-col gap-2">
                          <span className="font-wds-sans text-[15px] leading-5 text-wds-neutral-950">{l.itemName}</span>
                          <span className={cn('flex items-center gap-1.5 font-wds-sans text-[12px]', l.status === 'OUT' ? 'text-wds-error-fg' : 'text-wds-warning-fg')}>
                            <span className={cn('size-1.5 rounded-full', l.status === 'OUT' ? 'bg-wds-error-fg' : 'bg-wds-warning-fg')} aria-hidden />
                            {l.status === 'OUT' ? 'Out' : 'Low'}
                          </span>
                          <select
                            value={p.supplierId ?? ''}
                            onChange={(e) => setPick(l, { supplierId: e.target.value || null, checked: false, qty: '' })}
                            aria-label={`Supplier for ${l.itemName}`}
                            className={cn('h-10 border bg-white px-2.5 font-wds-sans text-[13px] outline-none focus:shadow-wds-ring', p.supplierId ? 'border-wds-border-strong' : 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg')}
                          >
                            {p.supplierId ? null : <option value="">Choose supplier</option>}
                            {(l.supplierOptions.length ? l.supplierOptions : []).map((o) => (
                              <option key={o.supplierId} value={o.supplierId}>
                                {o.name.split(' ')[0]}
                              </option>
                            ))}
                            {l.supplierOptions.length === 0
                              ? (needs.data?.suppliers ?? []).map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))
                              : null}
                          </select>
                        </div>
                        <label className="flex h-10 w-[104px] shrink-0 items-center gap-1 border border-wds-border-strong bg-white px-2 focus-within:shadow-wds-ring">
                          <input
                            inputMode="decimal"
                            value={p.qty}
                            onChange={(e) => setPick(l, { qty: e.target.value.replace(/[^0-9.]/g, ''), checked: Number.parseFloat(e.target.value) > 0 })}
                            placeholder="—"
                            aria-label={`How much ${l.itemName}`}
                            className="min-w-0 grow bg-transparent text-right font-wds-mono text-[15px] outline-none placeholder:text-wds-text-faint"
                          />
                          <span className="font-wds-sans text-[12px] text-wds-text-secondary">{l.buyUnit ?? l.usageUnit}</span>
                        </label>
                      </div>
                    );
                  })}
                </section>
              ))
            )}
            {chosen.length > 0 ? (
              <div className="flex flex-col gap-1.5 pt-1">
                <label htmlFor="att-note" className="font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-text-secondary">
                  Note for {approver} (optional)
                </label>
                <textarea id="att-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Chicken is finishing before the weekend." className="min-h-[72px] border border-wds-border-strong bg-white p-3 font-wds-sans text-[14px] outline-none focus:shadow-wds-ring" />
              </div>
            ) : null}
            {problem ? (
              <PhoneErrorNote>
                {problem.message}{' '}
                {problem.openOrderId ? (
                  <Link href={`/app/inventory/purchasing/${problem.openOrderId}`} className="underline">
                    Open it
                  </Link>
                ) : null}
              </PhoneErrorNote>
            ) : null}
          </div>
        ) : null}

        {tab === 'receive' ? (
          <div className="flex flex-col gap-3 p-4">
            {orders.status === 'error' ? (
              <StockErrorCard title="We couldn't load the deliveries" description={orders.error ?? 'Try again.'} onRetry={() => void orders.reload()} />
            ) : !orders.data ? (
              <div className="h-24 animate-pulse bg-wds-neutral-100" aria-busy aria-label="Loading deliveries" />
            ) : toReceive.length === 0 ? (
              <StockEmptyCard title="Nothing to receive" description="Orders that are on their way show here. Open one when the goods arrive." />
            ) : (
              toReceive.map((o) => {
                const s = statusOf(o);
                return (
                  <article key={o.id} className="flex flex-col gap-2.5 border border-wds-border p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-wds-mono text-[12px] text-wds-neutral-950">{o.reference}</span>
                      <span className={cn('rounded-[2px] border px-2 py-0.5 font-wds-sans text-[11px]', pill[s.tone])}>{s.text}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-wds-sans text-[16px] font-semibold text-wds-neutral-950">{o.supplier.name}</span>
                      <span className="font-wds-sans text-[13px] text-wds-text-secondary">{o.itemSummary}</span>
                    </div>
                    <PhonePrimaryButton asChild>
                      <Link href={`/app/inventory/receiving/${o.id}`}>Receive delivery</Link>
                    </PhonePrimaryButton>
                  </article>
                );
              })
            )}
          </div>
        ) : null}

        {tab === 'orders' ? (
          <div className="flex flex-col gap-3 p-4">
            {sent ? <PhoneSuccessNote title="Sent for approval">{sent}</PhoneSuccessNote> : null}
            {orders.status === 'error' ? (
              <StockErrorCard title="We couldn't load your orders" description={orders.error ?? 'Try again.'} onRetry={() => void orders.reload()} />
            ) : !orders.data ? (
              <div className="h-24 animate-pulse bg-wds-neutral-100" aria-busy aria-label="Loading your orders" />
            ) : myOrders.length === 0 ? (
              <StockEmptyCard title="No orders yet" description="Ask for stock on the Restock tab and your orders show here." />
            ) : (
              [...myOrders]
                .sort((a, b) => Number(b.status === 'RETURNED') - Number(a.status === 'RETURNED') || Number(b.status === 'APPROVED') - Number(a.status === 'APPROVED'))
                .map((o) => {
                  const s = statusOf(o);
                  return (
                    <article key={o.id} className="flex flex-col gap-2.5 border border-wds-border p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/app/inventory/purchasing/${o.id}`} className="font-wds-mono text-[12px] text-wds-neutral-950">
                          {o.reference ?? 'Draft'}
                        </Link>
                        <span className={cn('flex items-center gap-1.5 rounded-[2px] border px-2 py-0.5 font-wds-sans text-[11px]', pill[s.tone])}>
                          <span className="size-1.5 rounded-full bg-current" aria-hidden />
                          {s.text}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-wds-sans text-[16px] font-semibold text-wds-neutral-950">{o.supplier.name}</span>
                        <span className="font-wds-sans text-[13px] text-wds-text-secondary">{o.itemSummary}</span>
                      </div>
                      {o.status === 'RETURNED' ? (
                        <div className="flex flex-col gap-1 border border-wds-border bg-wds-neutral-50 px-3 py-2.5">
                          <span className="font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-text-secondary">Note from {o.returnedBy?.name.split(' ')[0] ?? approver}</span>
                          <span className="font-wds-sans text-[14px] leading-5 text-wds-neutral-950">{o.returnedNote}</span>
                        </div>
                      ) : null}
                      {o.status === 'AWAITING_APPROVAL' ? <span className="font-wds-sans text-[13px] text-wds-text-secondary">Waiting for {approver} to approve</span> : null}
                      {o.status === 'RETURNED' && o.can.edit ? (
                        <PhonePrimaryButton asChild>
                          <Link href={`/app/inventory/purchasing/new?edit=${o.id}`}>Edit and send again</Link>
                        </PhonePrimaryButton>
                      ) : null}
                      {o.status === 'APPROVED' && o.can.send ? (
                        <div className="flex gap-2">
                          <PhonePrimaryButton className="grow basis-0" onClick={() => void mark(o, 'PRINT')}>
                            Print or share
                          </PhonePrimaryButton>
                          <PhonePrimaryButton variant="secondary" className="grow basis-0" onClick={() => void mark(o, 'MANUAL')}>
                            Mark as sent
                          </PhonePrimaryButton>
                        </div>
                      ) : null}
                    </article>
                  );
                })
            )}
          </div>
        ) : null}
      </div>

      {tab === 'restock' && chosen.length > 0 ? (
        <div className="flex shrink-0 flex-col gap-2 border-t border-wds-border bg-wds-surface px-4 py-3">
          <span className="font-wds-sans text-[12px] text-wds-text-secondary">
            {chosen.length} item{chosen.length === 1 ? '' : 's'} · {chosenSuppliers.size} supplier{chosenSuppliers.size === 1 ? '' : 's'}
          </span>
          <PhonePrimaryButton onClick={() => void send()} disabled={sending}>
            {sending ? 'Sending…' : 'Send order for approval'}
          </PhonePrimaryButton>
        </div>
      ) : null}
    </div>
  );
}
