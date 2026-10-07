'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Input } from '@/components/ui2/input';
import { StockEmptyCard, StockErrorCard, SkeletonRows, TableRowSkeleton } from '../../_shared/components/stock-states';
import { useLoader } from '../../_shared/hooks/use-async';
import { StageDots, thClass } from '../../purchasing/components/parts';
import { dayMonth, fullDate, kes2 } from '../../purchasing/lib/format';
import { usePurchasing } from '../../purchasing/hooks/use-purchasing';
import type { OrderRow, StatementLine, SupplierStatement } from '../../purchasing/types';

type Filter = 'all' | 'open' | 'closed';

const standing = (o: OrderRow): { text: string; tone: 'ok' | 'warn' | 'bad' | 'muted'; when: string } => {
  switch (o.status) {
    case 'DRAFT':
      return { text: 'Draft', tone: 'muted', when: '' };
    case 'AWAITING_APPROVAL':
      return { text: 'Awaiting approval', tone: 'warn', when: '' };
    case 'RETURNED':
      return { text: 'Returned with a note', tone: 'warn', when: '' };
    case 'APPROVED':
      return { text: 'Approved, ready to send', tone: 'warn', when: '' };
    case 'SENT':
      return { text: 'Sent, awaiting delivery', tone: o.dueLabel === 'OVERDUE' ? 'bad' : 'warn', when: o.expectedDate ? `Expected ${dayMonth(o.expectedDate)}` : '' };
    case 'DELIVERED':
      return { text: 'Delivered, awaiting invoice', tone: 'warn', when: dayMonth(o.delivery?.receivedAt) };
    case 'INVOICED':
      return o.invoice?.disputed
        ? { text: 'Invoiced, disputed', tone: 'bad', when: '' }
        : (o.dueInDays ?? 0) < 0
          ? { text: 'Invoiced, to pay', tone: 'bad', when: `${Math.abs(o.dueInDays ?? 0)} days overdue` }
          : { text: 'Invoiced, to pay', tone: 'warn', when: `Due ${dayMonth(o.invoice?.dueDate)}` };
    case 'CLOSED':
      return { text: 'Closed, paid in full', tone: 'ok', when: dayMonth(o.tracker.find((t) => t.step === 'PAID')?.at) };
    case 'CANCELLED':
      return { text: 'Cancelled', tone: 'muted', when: dayMonth(o.cancelled?.at) };
  }
};

const TONE = { ok: 'text-wds-success-fg', warn: 'text-wds-warning-fg', bad: 'text-wds-error-fg', muted: 'text-wds-text-secondary' } as const;

/**
 * The supplier's Orders tab (Paper `25`): every order placed with this supplier and where each one stands, read from the Purchasing
 * the live Purchasing API. A row opens the purchase file. "New order from X" starts an order for this supplier.
 */
export function SupplierOrdersTab({
  supplierName,
  supplierId,
  orders,
  status,
  error,
  onRetry,
  canOrder,
  showMoney,
}: {
  supplierName: string;
  supplierId: string | null;
  orders: OrderRow[] | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  onRetry: () => void;
  canOrder: boolean;
  showMoney: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<Filter>('all');
  const [period, setPeriod] = React.useState('any');
  const first = supplierName.split(' ')[0];

  const rows = React.useMemo(() => {
    const cutoff = period === 'any' ? null : Date.now() - Number(period) * 86_400_000;
    return [...(orders ?? [])]
      .filter((o) => filter === 'all' || (filter === 'closed' ? o.status === 'CLOSED' || o.status === 'CANCELLED' : o.status !== 'CLOSED' && o.status !== 'CANCELLED'))
      .filter((o) => cutoff === null || Date.parse(o.submittedAt ?? o.raisedAt) >= cutoff)
      .sort((a, b) => (b.submittedAt ?? b.raisedAt).localeCompare(a.submittedAt ?? a.raisedAt));
  }, [orders, filter, period]);
  const open = (orders ?? []).filter((o) => o.status !== 'CLOSED' && o.status !== 'CANCELLED').length;
  const closed = (orders?.length ?? 0) - open;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-wds-sans text-[17px] font-semibold leading-6 text-wds-text-ink">Orders with {first}</h2>
          <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">Every order placed with this supplier and where each one stands.</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Show orders" className="flex overflow-hidden rounded-[2px] border border-wds-text-ink">
            {(
              [
                ['all', 'All', orders?.length ?? 0],
                ['open', 'Open', open],
                ['closed', 'Closed', closed],
              ] as const
            ).map(([k, label, n]) => (
              <button
                key={k}
                type="button"
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
                className={cn('flex h-8 items-center gap-1.5 px-3.5 font-wds-sans text-[13px] outline-none focus-visible:shadow-wds-ring', filter === k ? 'bg-wds-text-ink font-medium text-white' : 'bg-white text-wds-text-ink hover:bg-wds-neutral-50')}
              >
                {label}
                <span className={cn('font-wds-mono text-[11px]', filter === k ? 'text-white/70' : 'text-wds-text-faint')}>{n}</span>
              </button>
            ))}
          </div>
          <label className="flex h-8 items-center border border-wds-border-strong bg-white px-3 font-wds-sans text-[13px] text-wds-text-ink">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Date range" className="bg-transparent outline-none">
              <option value="any">Any date</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </label>
          {canOrder && supplierId ? (
            <Button asChild className="h-8 bg-wds-caramel-600 px-4 hover:bg-wds-caramel-700">
              <Link href={`/app/inventory/purchasing/new?supplier=${supplierId}`}>New order from {first}</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {status === 'error' ? (
        <StockErrorCard title="Couldn’t load the orders" description={error ?? 'Try again.'} onRetry={onRetry} />
      ) : status === 'loading' || (status === 'idle' && supplierId && !orders) ? (
        <SkeletonRows count={4} label="Loading orders">
          {(i) => <TableRowSkeleton key={i} />}
        </SkeletonRows>
      ) : !supplierId || (orders?.length ?? 0) === 0 ? (
        <StockEmptyCard title="No orders with this supplier yet" description="Orders raised in Purchasing show here, with where each one stands." />
      ) : rows.length === 0 ? (
        <StockEmptyCard title="No orders match" description="Try a different filter." actionLabel="Show all" onAction={() => { setFilter('all'); setPeriod('any'); }} />
      ) : (
        <div className="flex flex-col">
          <div className="flex h-[34px] items-center gap-4 border-b border-wds-text-ink">
            <span className={cn(thClass, 'w-[84px] shrink-0')}>Order</span>
            <span className={cn(thClass, 'w-[56px] shrink-0')}>Date</span>
            <span className={cn(thClass, 'grow')}>Items</span>
            {showMoney ? <span className={cn(thClass, 'w-[96px] shrink-0 text-right')}>Ordered</span> : null}
            {showMoney ? <span className={cn(thClass, 'w-[96px] shrink-0 text-right')}>Invoiced</span> : null}
            {showMoney ? <span className={cn(thClass, 'w-[96px] shrink-0 text-right')}>Paid</span> : null}
            <span className={cn(thClass, 'w-[250px] shrink-0')}>Where it stands</span>
          </div>
          {rows.map((o) => {
            const s = standing(o);
            const paid = Number.parseFloat(o.money?.paid ?? '0');
            return (
              <div
                key={o.id}
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/app/inventory/purchasing/${o.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') router.push(`/app/inventory/purchasing/${o.id}`);
                }}
                className="flex min-h-[54px] cursor-pointer items-center gap-4 border-b border-wds-neutral-100 py-2 outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
              >
                <span className="w-[84px] shrink-0 font-wds-mono text-[12px] text-wds-text-ink">{o.reference ?? 'Draft'}</span>
                <span className="w-[56px] shrink-0 font-wds-mono text-[12px] text-wds-text-secondary">{dayMonth(o.submittedAt ?? o.raisedAt)}</span>
                <span className="min-w-0 grow truncate font-wds-sans text-[13px] text-wds-text-ink">{o.itemNames}</span>
                {showMoney ? <span className="w-[96px] shrink-0 text-right font-wds-mono text-[13px] text-wds-text-ink">{kes2(o.money?.ordered)}</span> : null}
                {showMoney ? <span className="w-[96px] shrink-0 text-right font-wds-mono text-[13px] text-wds-text-ink">{o.money?.invoiced ? kes2(o.money.invoiced) : <span className="text-wds-text-faint">—</span>}</span> : null}
                {showMoney ? <span className="w-[96px] shrink-0 text-right font-wds-mono text-[13px] text-wds-text-ink">{paid > 0 ? kes2(paid) : <span className="text-wds-text-faint">—</span>}</span> : null}
                <div className="flex w-[250px] shrink-0 flex-col gap-1">
                  <StageDots status={o.status} />
                  <span className={cn('whitespace-nowrap font-wds-sans text-[12px] leading-4', TONE[s.tone])}>
                    {s.text}
                    {s.when ? <span className="ml-1.5 font-wds-mono text-[11px] text-wds-text-secondary">{s.when}</span> : null}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        {orders && orders.length > 0 ? `Showing ${rows.length} of ${orders.length} order${orders.length === 1 ? '' : 's'}. Open a row to see its purchase file.` : ''}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ Statement (Paper 26)

const typeTone: Record<StatementLine['kind'], string> = { INVOICE: 'text-wds-text-secondary', ADVANCE: 'text-wds-info-fg', PAYMENT: 'text-wds-success-fg', REVERSAL: 'text-wds-error-fg', VOID: 'text-wds-text-secondary' };
const typeLabel: Record<StatementLine['kind'], string> = { INVOICE: 'Invoice', ADVANCE: 'Advance', PAYMENT: 'Payment', REVERSAL: 'Reversal', VOID: 'Voided' };

/** A balance as the statement writes it: a negative one (an advance held before its invoice) in brackets. */
export const balanceText = (v: string): string => {
  const n = Number.parseFloat(v);
  return n < 0 ? `(${kes2(Math.abs(n))})` : kes2(n);
};

/** The statement as CSV: one row per line, with the opening and closing balance. */
export function statementCsv(s: SupplierStatement): string {
  const q = (v: string): string => `"${v.replaceAll('"', '""')}"`;
  const rows = [
    ['Date', 'Reference', 'Description', 'Type', 'Debit', 'Credit', 'Balance'],
    [s.from, '', 'Opening balance', '', '', '', s.openingBalance],
    ...s.lines.map((l) => [l.date, l.reference, l.description + (l.superseded ? ' (struck through)' : ''), typeLabel[l.kind], l.debit, l.credit, l.balance]),
    [s.to, '', 'Closing balance', '', s.totalDebit, s.totalCredit, s.closingBalance],
  ];
  return rows.map((r) => r.map(q).join(',')).join('\n');
}

/**
 * The supplier's statement of account (Paper `26`): what Wendo owes this supplier, in date order. Credit adds to it, debit reduces
 * it; a reversed payment and a voided invoice stay on it, struck through. Export PDF opens the A4 print (`27`); Export CSV
 * downloads the same lines. The Branch Manager sees amounts, dates and references but never the supplier's payment details.
 */
export function SupplierStatementTab({ supplierId, supplierName }: { supplierId: string | null; supplierName: string }) {
  const { service, data: tick, ready } = usePurchasing();
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const { data, status, error, reload } = useLoader<SupplierStatement>(
    supplierId && ready ? `statement:${supplierId}:${from}:${to}` : null,
    () => service.getSupplierStatement(supplierId as string, { from: from || undefined, to: to || undefined }),
    'We could not load the statement.'
  );
  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;
  React.useEffect(() => {
    void reloadRef.current();
  }, [tick, service]);
  const first = supplierName.split(' ')[0];

  const exportCsv = (): void => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([statementCsv(data)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `statement-${data.supplier.code}-${data.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!supplierId) return <StockEmptyCard title="No statement yet" description="This supplier has no purchases yet, so there is nothing to put on a statement." />;
  if (status === 'error') return <StockErrorCard title="Couldn’t load the statement" description={error ?? 'Try again.'} onRetry={() => void reload()} />;
  if (!data) {
    return (
      <SkeletonRows count={5} label="Loading the statement">
        {(i) => <TableRowSkeleton key={i} />}
      </SkeletonRows>
    );
  }
  const d = data;
  const buckets: Array<[string, string, boolean?]> = [
    ['Current', d.ageing.current],
    ['1-30 days', d.ageing.days1to30, true],
    ['31-60 days', d.ageing.days31to60, true],
    ['61-90 days', d.ageing.days61to90, true],
    ['90+ days', d.ageing.days90plus, true],
  ];
  const owed = buckets.reduce((t, [, v]) => t + Number.parseFloat(v), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-wds-sans text-[17px] font-semibold leading-6 text-wds-text-ink">Statement of account</h2>
          <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">What Wendo owes {first}, in date order. Credit adds to it, debit reduces it.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-text-secondary">From</span>
            <Input type="date" value={from || d.from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-[140px] font-wds-mono" aria-label="From" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-text-secondary">To</span>
            <Input type="date" value={to || d.to} onChange={(e) => setTo(e.target.value)} className="h-8 w-[140px] font-wds-mono" aria-label="To" />
          </label>
          <Button variant="secondary" asChild>
            <Link href={`/app/inventory/purchasing-print/statement/${supplierId}?from=${d.from}&to=${d.to}`} target="_blank">
              Export PDF
            </Link>
          </Button>
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex h-[34px] items-center gap-4 border-b border-wds-text-ink">
          <span className={cn(thClass, 'w-[56px] shrink-0')}>Date</span>
          <span className={cn(thClass, 'w-[100px] shrink-0')}>Reference</span>
          <span className={cn(thClass, 'grow')}>Description</span>
          <span className={cn(thClass, 'w-[84px] shrink-0')}>Type</span>
          <span className={cn(thClass, 'w-[110px] shrink-0 text-right')}>Debit</span>
          <span className={cn(thClass, 'w-[110px] shrink-0 text-right')}>Credit</span>
          <span className={cn(thClass, 'w-[110px] shrink-0 text-right')}>Balance</span>
        </div>
        <div className="flex h-12 items-center gap-4 border-b border-wds-neutral-100">
          <span className="w-[56px] shrink-0 font-wds-mono text-[12px] text-wds-text-secondary">{dayMonth(d.from)}</span>
          <span className="w-[100px] shrink-0" />
          <span className="grow font-wds-sans text-[13px] text-wds-text-secondary">Opening balance</span>
          <span className="w-[84px] shrink-0" />
          <span className="w-[110px] shrink-0" />
          <span className="w-[110px] shrink-0" />
          <span className="w-[110px] shrink-0 text-right font-wds-mono text-[13px] text-wds-text-ink">{balanceText(d.openingBalance)}</span>
        </div>
        {d.lines.length === 0 ? (
          <p className="py-6 font-wds-sans text-[13px] text-wds-text-secondary">Nothing was invoiced or paid in this period.</p>
        ) : null}
        {d.lines.map((l, i) => (
          <div key={`${l.reference}-${i}`} className={cn('flex min-h-12 items-center gap-4 border-b border-wds-neutral-100 py-2', l.superseded && 'text-wds-text-faint')}>
            <span className="w-[56px] shrink-0 font-wds-mono text-[12px] text-wds-text-secondary">{dayMonth(l.date)}</span>
            <span className={cn('w-[100px] shrink-0 font-wds-mono text-[12px]', l.superseded ? 'line-through' : 'text-wds-text-ink')}>{l.reference}</span>
            <span className={cn('min-w-0 grow truncate font-wds-sans text-[13px]', l.superseded ? 'line-through' : 'text-wds-text-ink')}>{l.description}</span>
            <span className={cn('w-[84px] shrink-0 font-wds-sans text-[12px]', typeTone[l.kind])}>{l.superseded && l.kind !== 'INVOICE' ? 'Reversed' : l.superseded ? 'Voided' : typeLabel[l.kind]}</span>
            <span className={cn('w-[110px] shrink-0 text-right font-wds-mono text-[13px]', l.superseded && 'line-through')}>{l.debit ? kes2(l.debit) : <span className="text-wds-text-faint">—</span>}</span>
            <span className={cn('w-[110px] shrink-0 text-right font-wds-mono text-[13px]', l.superseded && 'line-through')}>{l.credit ? kes2(l.credit) : <span className="text-wds-text-faint">—</span>}</span>
            <span className={cn('w-[110px] shrink-0 text-right font-wds-mono text-[13px]', Number.parseFloat(l.balance) < 0 ? 'text-wds-info-fg' : 'text-wds-text-ink')}>{balanceText(l.balance)}</span>
          </div>
        ))}
        <div className="flex h-11 items-center gap-4">
          <span className="w-[56px] shrink-0" />
          <span className="w-[100px] shrink-0" />
          <span className="grow font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-text-ink">Totals for the period</span>
          <span className="w-[84px] shrink-0" />
          <span className="w-[110px] shrink-0 text-right font-wds-mono text-[13px] font-medium text-wds-text-ink">{kes2(d.totalDebit)}</span>
          <span className="w-[110px] shrink-0 text-right font-wds-mono text-[13px] font-medium text-wds-text-ink">{kes2(d.totalCredit)}</span>
          <span className="w-[110px] shrink-0" />
        </div>
        <div className="flex h-12 items-center gap-4 border-t-2 border-wds-text-ink bg-wds-surface-sunken">
          <span className="w-[56px] shrink-0 font-wds-mono text-[12px] text-wds-text-secondary">{dayMonth(d.to)}</span>
          <span className="grow pl-[116px] font-wds-sans text-[14px] font-semibold text-wds-text-ink">Closing balance owed to {first}</span>
          <span className="w-[110px] shrink-0 pr-0 text-right font-wds-mono text-[16px] font-semibold text-wds-text-ink">{balanceText(d.closingBalance)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-text-secondary">Ageing at {fullDate(d.to)} · days past due</span>
        <div className="flex border border-wds-border bg-white">
          {buckets.map(([label, value, late]) => (
            <div key={label} className="flex grow basis-0 flex-col gap-1 border-r border-wds-border px-4 py-3">
              <span className="font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-text-secondary">{label}</span>
              <span className={cn('font-wds-mono text-[15px]', late && Number.parseFloat(value) > 0 ? 'text-wds-error-fg' : 'text-wds-text-faint')}>{kes2(value)}</span>
            </div>
          ))}
          <div className="flex grow basis-0 flex-col gap-1 bg-wds-surface-sunken px-4 py-3">
            <span className="font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-text-secondary">Total owed</span>
            <span className="font-wds-mono text-[15px] font-semibold text-wds-text-ink">{kes2(owed)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
