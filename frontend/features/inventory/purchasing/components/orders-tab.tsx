'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { SearchInput } from '@/components/ui2/search-input';
import { StockEmptyCard, StockErrorCard, SkeletonRows, TableRowSkeleton } from '../../_shared/components/stock-states';
import { useLoader } from '../../_shared/hooks/use-async';
import { dayMonth, kes, STAGE_WORD, whenLabel } from '../lib/format';
import { usePurchasing } from '../hooks/use-purchasing';
import type { OrderRow, Stage } from '../types';
import { ApproveOrderSheet } from './approve-order-sheet';
import { DotLabel, StageDots, thClass } from './parts';

const STAGE_FOR_TAB = { approval: 'APPROVAL', receive: 'RECEIVE', invoice: 'INVOICE', pay: 'PAY', closed: 'CLOSED' } as const;
export type OrdersTabKey = keyof typeof STAGE_FOR_TAB;

const EMPTY: Record<OrdersTabKey, { title: string; description: string }> = {
  approval: { title: 'Nothing is waiting for approval', description: 'Orders raised by the team show here until the Store Manager approves them.' },
  receive: { title: 'No orders to receive', description: 'Approved and sent orders show here until the goods arrive.' },
  invoice: { title: 'No orders awaiting an invoice', description: 'Delivered orders wait here until the supplier’s invoice is added.' },
  pay: { title: 'Nothing to pay', description: 'Invoiced orders show here until they are paid.' },
  closed: { title: 'No closed orders yet', description: 'Paid and cancelled orders are kept here.' },
};

const dueTone = (row: OrderRow): { tone: 'warning' | 'error' | 'muted'; text: string } | null => {
  if (row.dueLabel === null) return null;
  if (row.dueLabel === 'OVERDUE') return { tone: 'error', text: `Overdue by ${Math.abs(row.dueInDays ?? 0)} day${Math.abs(row.dueInDays ?? 0) === 1 ? '' : 's'}` };
  if (row.dueLabel === 'DUE_TODAY') return { tone: 'warning', text: 'Due today' };
  return { tone: 'muted', text: `In ${row.dueInDays} day${row.dueInDays === 1 ? '' : 's'} · ${dayMonth(row.expectedDate)}` };
};

/** The advance already paid on an order, for the Value column's sub-line. */
const advanceOf = (row: OrderRow): number => row.payments.filter((p) => p.kind === 'ADVANCE' && p.status === 'RECORDED').reduce((t, p) => t + Number.parseFloat(p.amount), 0);

/**
 * Tabs 2 to 6: the orders at one stage, as a table (Paper `04`, `11`, and the same pattern for the stages Session 2 refines).
 * The row action depends on the caller's capabilities for that order, never on a role name.
 */
export function OrdersTab({ tab }: { tab: OrdersTabKey }) {
  const router = useRouter();
  const { service, data: tick, can, ready } = usePurchasing();
  const stage: Stage = STAGE_FOR_TAB[tab];
  const [search, setSearch] = React.useState('');
  const [supplierId, setSupplierId] = React.useState('');
  const [raisedBy, setRaisedBy] = React.useState('');
  const [approveId, setApproveId] = React.useState<string | null>(null);
  // The order's value follows item costs (the Attendant sees it); the advance on it is financial data.
  const showValue = can('catalog.see_costs');
  const showAdvance = can('payables.read');

  const { data, status, error, reload } = useLoader(ready ? `orders:${stage}` : null,() => service.listOrders({ stage }), 'We could not load the orders.');
  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;
  React.useEffect(() => {
    void reloadRef.current();
  }, [tick, service]);

  if (status === 'loading' || (status === 'idle' && !data)) {
    return (
      <div className="flex flex-col" aria-busy>
        <SkeletonRows count={5} label="Loading orders">
          {(i) => <TableRowSkeleton key={i} />}
        </SkeletonRows>
      </div>
    );
  }
  if (status === 'error' || !data) return <StockErrorCard title="We couldn't load the orders" description={error ?? 'Something went wrong. Try again.'} onRetry={() => void reload()} />;
  if (data.total === 0) return <StockEmptyCard title={EMPTY[tab].title} description={EMPTY[tab].description} />;

  const suppliers = Array.from(new Map(data.orders.map((o) => [o.supplier.id, o.supplier.name])).entries());
  const raisers = Array.from(new Map(data.orders.map((o) => [o.raisedBy.id, o.raisedBy.name])).entries());
  // To receive: what is due first (overdue, then today, then soonest); every other tab keeps newest first.
  const ordered = tab === 'receive' ? [...data.orders].sort((a, b) => (a.dueInDays ?? 999) - (b.dueInDays ?? 999)) : data.orders;
  const rows = ordered.filter(
    (o) =>
      (!search || `${o.reference ?? ''} ${o.supplier.name}`.toLowerCase().includes(search.toLowerCase())) &&
      (!supplierId || o.supplier.id === supplierId) &&
      (!raisedBy || o.raisedBy.id === raisedBy)
  );
  const total = rows.reduce((t, o) => t + Number.parseFloat(o.orderedTotal || '0'), 0);
  const isReceive = tab === 'receive';
  const dateHeader = tab === 'approval' ? 'Submitted' : isReceive ? 'Sent' : 'Updated';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order or supplier" aria-label="Search order or supplier" shortcutHint="" className="w-[260px]" />
        <label className="flex h-8 items-center gap-1 border border-wds-border-strong bg-white px-3 font-wds-sans text-wds-body-sm text-wds-neutral-950">
          <span className="text-wds-text-secondary">Supplier:</span>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="bg-transparent outline-none" aria-label="Filter by supplier">
            <option value="">All</option>
            {suppliers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-8 items-center gap-1 border border-wds-border-strong bg-white px-3 font-wds-sans text-wds-body-sm text-wds-neutral-950">
          <span className="text-wds-text-secondary">Raised by:</span>
          <select value={raisedBy} onChange={(e) => setRaisedBy(e.target.value)} className="bg-transparent outline-none" aria-label="Filter by who raised it">
            <option value="">Anyone</option>
            {raisers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.04em] text-wds-text-secondary">
          {rows.length} order{rows.length === 1 ? '' : 's'}
          {showValue ? ` · KES ${kes(total)}` : ''}
        </span>
      </div>

      {rows.length === 0 ? (
        <StockEmptyCard title="No orders match" description="Try a different search or filter." actionLabel="Clear filters" onAction={() => { setSearch(''); setSupplierId(''); setRaisedBy(''); }} />
      ) : (
        <div className="flex flex-col">
          <div className="flex h-[30px] shrink-0 items-center gap-4 border-b border-wds-neutral-950">
            <span className={cn(thClass, 'w-[84px] shrink-0')}>Order</span>
            <span className={cn(thClass, 'grow')}>Supplier</span>
            <span className={cn(thClass, isReceive ? 'w-[120px]' : 'w-[150px]', 'shrink-0')}>Raised by</span>
            <span className={cn(thClass, isReceive ? 'w-14' : 'w-24', 'shrink-0')}>{dateHeader}</span>
            <span className={cn(thClass, 'w-[112px] shrink-0')}>Stage</span>
            {isReceive ? <span className={cn(thClass, 'w-[140px] shrink-0')}>Expected</span> : null}
            {showValue ? <span className={cn(thClass, 'w-[90px] shrink-0 text-right')}>Value</span> : null}
            <span className="w-[90px] shrink-0" />
          </div>
          {rows.map((o) => {
            const due = dueTone(o);
            const advance = advanceOf(o);
            const approving = tab === 'approval' && o.can.approve;
            const receiving = isReceive && o.can.receive && (o.dueLabel === 'DUE_TODAY' || o.dueLabel === 'OVERDUE');
            return (
              <div
                key={o.id}
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/app/inventory/purchasing/${o.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') router.push(`/app/inventory/purchasing/${o.id}`);
                }}
                className="flex h-[58px] shrink-0 cursor-pointer items-center gap-4 border-b border-wds-neutral-100 outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
              >
                <span className="w-[84px] shrink-0 font-wds-mono text-wds-caption text-wds-neutral-950">{o.reference ?? 'Draft'}</span>
                <div className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="truncate font-wds-sans text-wds-body-sm leading-4 text-wds-neutral-950">{o.supplier.name}</span>
                  <span className="truncate font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">{o.itemSummary}</span>
                </div>
                <span className={cn('shrink-0 font-wds-sans text-wds-body-sm text-wds-neutral-950', isReceive ? 'w-[120px]' : 'w-[150px]')}>{o.raisedBy.role === 'Accountant' ? `${o.raisedBy.name} (Accountant)` : o.raisedBy.name}</span>
                <span className={cn('shrink-0 font-wds-mono text-wds-caption text-wds-text-secondary', isReceive ? 'w-14' : 'w-24')}>
                  {isReceive ? dayMonth(o.sentAt) : whenLabel(tab === 'approval' ? o.submittedAt : (o.sentAt ?? o.submittedAt))}
                </span>
                <StageDots status={o.status} label={STAGE_WORD[o.status]} />
                {isReceive ? <span className="w-[140px] shrink-0">{due ? <DotLabel tone={due.tone}>{due.text}</DotLabel> : <span className="font-wds-sans text-wds-caption text-wds-text-secondary">Not sent yet</span>}</span> : null}
                {showValue ? (
                  <div className="flex w-[90px] shrink-0 flex-col items-end gap-0.5">
                    <span className="font-wds-mono text-wds-body-sm text-wds-neutral-950">{kes(o.orderedTotal)}</span>
                    {showAdvance && advance > 0 ?<span className="font-wds-sans text-[11px] leading-[14px] text-wds-info-fg">Advance {kes(advance)}</span> : null}
                  </div>
                ) : null}
                <div className="flex w-[90px] shrink-0 justify-end" onClick={(e) => e.stopPropagation()}>
                  {approving ? (
                    <Button size="sm" onClick={() => setApproveId(o.id)}>
                      Approve
                    </Button>
                  ) : receiving ? (
                    <Button size="sm" asChild>
                      <Link href={`/app/inventory/receiving/${o.id}`}>Receive</Link>
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/app/inventory/purchasing/${o.id}`}>Open</Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ApproveOrderSheet orderId={approveId} onClose={() => setApproveId(null)} />
    </div>
  );
}
