'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { SearchInput } from '@/components/ui2/search-input';
import { SkeletonRows, StockEmptyCard, StockErrorCard, TableRowSkeleton } from '../../_shared/components/stock-states';
import { useStageOrders } from '../hooks/use-stage-orders';
import { dayMonth, kes, STAGE_WORD } from '../lib/format';
import type { OrderRow } from '../types';
import { AddInvoiceSheet } from './invoice-sheet';
import { DotLabel, StageDots, thClass } from './parts';
import { RecordPaymentSheet } from './payment-sheet';

const FILTER = 'flex h-8 items-center gap-1 border border-wds-border-strong bg-white px-3 font-wds-sans text-wds-body-sm text-wds-neutral-950';

const daysAgo = (iso: string | null | undefined, now = new Date()): number | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
};

const advanceOf = (row: OrderRow): number => row.payments.filter((p) => p.kind === 'ADVANCE' && p.status === 'RECORDED').reduce((t, p) => t + Number.parseFloat(p.amount), 0);

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

function Loading() {
  return (
    <div className="flex flex-col" aria-busy>
      <SkeletonRows count={5} label="Loading orders">
        {(i) => <TableRowSkeleton key={i} />}
      </SkeletonRows>
    </div>
  );
}

function Select({ label, value, onChange, options, aria }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]>; aria: string }) {
  return (
    <label className={FILTER}>
      <span className="text-wds-text-secondary">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent outline-none" aria-label={aria}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

// ------------------------------------------------------------------ Awaiting invoice (Paper 16)

/** Orders delivered and waiting for the supplier's invoice. "Add invoice" opens the drawer over the list. */
export function AwaitingInvoiceTab() {
  const router = useRouter();
  const { data, status, error, reload, can } = useStageOrders('INVOICE');
  const [search, setSearch] = React.useState('');
  const [supplierId, setSupplierId] = React.useState('');
  const [period, setPeriod] = React.useState('any');
  const [invoiceFor, setInvoiceFor] = React.useState<string | null>(null);
  const showMoney = can('payables.read');

  if (status === 'loading' || (status === 'idle' && !data)) return <Loading />;
  if (status === 'error' || !data) return <StockErrorCard title="We couldn't load the orders" description={error ?? 'Something went wrong. Try again.'} onRetry={() => void reload()} />;
  if (data.total === 0) return <StockEmptyCard title="No orders awaiting an invoice" description="Delivered orders wait here until the supplier’s invoice is added." />;

  const suppliers = Array.from(new Map(data.orders.map((o) => [o.supplier.id, o.supplier.name])).entries());
  const rows = data.orders
    .filter((o) => !search || `${o.reference ?? ''} ${o.supplier.name}`.toLowerCase().includes(search.toLowerCase()))
    .filter((o) => !supplierId || o.supplier.id === supplierId)
    .filter((o) => {
      const d = daysAgo(o.delivery?.receivedAt) ?? 0;
      return period === 'any' || (period === 'today' && d === 0) || (period === 'week' && d <= 7) || (period === 'older' && d > 3);
    })
    .sort((a, b) => (a.delivery?.receivedAt ?? '').localeCompare(b.delivery?.receivedAt ?? ''));
  const total = rows.reduce((t, o) => t + Number.parseFloat(o.deliveredTotal ?? '0'), 0);

  return (
    <Frame>
      <div className="flex items-center gap-2">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order or supplier" aria-label="Search order or supplier" shortcutHint="" className="w-[260px]" />
        <Select label="Supplier:" value={supplierId} onChange={setSupplierId} aria="Filter by supplier" options={[['', 'All'], ...suppliers]} />
        <Select
          label="Delivered:"
          value={period}
          onChange={setPeriod}
          aria="Filter by delivery date"
          options={[
            ['any', 'Any time'],
            ['today', 'Today'],
            ['week', 'Last 7 days'],
            ['older', 'More than 3 days ago'],
          ]}
        />
        <span className="ml-auto font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.04em] text-wds-text-secondary">
          {rows.length} order{rows.length === 1 ? '' : 's'}
          {showMoney ? ` · KES ${kes(total)} delivered` : ''}
        </span>
      </div>

      {rows.length === 0 ? (
        <StockEmptyCard
          title="No orders match"
          description="Try a different search or filter."
          actionLabel="Clear filters"
          onAction={() => {
            setSearch('');
            setSupplierId('');
            setPeriod('any');
          }}
        />
      ) : (
        <div className="flex flex-col">
          <div className="flex h-[30px] shrink-0 items-center gap-4 border-b border-wds-neutral-950">
            <span className={cn(thClass, 'w-[84px] shrink-0')}>Order</span>
            <span className={cn(thClass, 'grow')}>Supplier</span>
            <span className={cn(thClass, 'w-[112px] shrink-0')}>Stage</span>
            <span className={cn(thClass, 'w-[100px] shrink-0')}>Delivered</span>
            {showMoney ? <span className={cn(thClass, 'w-[110px] shrink-0 text-right')}>Delivered value</span> : null}
            {showMoney ? <span className={cn(thClass, 'w-[80px] shrink-0 text-right')}>Advance</span> : null}
            <span className="w-[100px] shrink-0" />
          </div>
          {rows.map((o) => {
            const ago = daysAgo(o.delivery?.receivedAt);
            const advance = advanceOf(o);
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
                <span className="w-[84px] shrink-0 font-wds-mono text-wds-caption text-wds-neutral-950">{o.reference}</span>
                <div className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="truncate font-wds-sans text-wds-body-sm leading-4 text-wds-neutral-950">{o.supplier.name}</span>
                  <span className="truncate font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">{o.deliverySummary}</span>
                </div>
                <StageDots status={o.status} label={STAGE_WORD[o.status]} />
                <div className="flex w-[100px] shrink-0 flex-col gap-0.5">
                  <span className="font-wds-mono text-wds-caption text-wds-neutral-950">{dayMonth(o.delivery?.receivedAt)}</span>
                  <span className={cn('font-wds-sans text-[11px] leading-[14px]', (ago ?? 0) >= 3 ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>{ago === 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`}</span>
                </div>
                {showMoney ? <span className="w-[110px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-neutral-950">{kes(o.deliveredTotal)}</span> : null}
                {showMoney ? <span className={cn('w-[80px] shrink-0 text-right font-wds-mono text-wds-body-sm', advance > 0 ? 'text-wds-info-fg' : 'text-wds-text-faint')}>{advance > 0 ? kes(advance) : '—'}</span> : null}
                <div className="flex w-[100px] shrink-0 justify-end" onClick={(e) => e.stopPropagation()}>
                  {o.can.addInvoice ? (
                    <Button size="sm" onClick={() => setInvoiceFor(o.id)}>
                      Add invoice
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
      <AddInvoiceSheet orderId={invoiceFor} onClose={() => setInvoiceFor(null)} />
    </Frame>
  );
}

// ------------------------------------------------------------------ To pay (Paper 19)

const dueOf = (o: OrderRow): { tone: 'error' | 'warning' | 'muted'; text: string; soon: boolean } | null => {
  const inv = o.invoice;
  if (!inv) return null;
  if (inv.disputed) {
    const v = Number.parseFloat(inv.varianceAmount ?? '0');
    return { tone: 'error', text: `KES ${kes(Math.abs(v))} ${v > 0 ? 'over' : 'under'} delivery`, soon: false };
  }
  const d = o.dueInDays ?? 0;
  if (d < 0) return { tone: 'error', text: `Overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'}`, soon: true };
  if (d === 0) return { tone: 'warning', text: 'Due today', soon: true };
  return { tone: d <= 7 ? 'warning' : 'muted', text: `Due in ${d} day${d === 1 ? '' : 's'} · ${dayMonth(inv.dueDate)}`, soon: d <= 7 };
};

/** Invoices waiting to be paid, most overdue first. A disputed invoice shows "Open" (it is settled before it is paid). */
export function ToPayTab() {
  const router = useRouter();
  const { data, status, error, reload, can } = useStageOrders('PAY');
  const [search, setSearch] = React.useState('');
  const [supplierId, setSupplierId] = React.useState('');
  const [due, setDue] = React.useState('any');
  const [payFor, setPayFor] = React.useState<string | null>(null);
  const showMoney = can('payables.read');

  if (status === 'loading' || (status === 'idle' && !data)) return <Loading />;
  if (status === 'error' || !data) return <StockErrorCard title="We couldn't load the invoices" description={error ?? 'Something went wrong. Try again.'} onRetry={() => void reload()} />;
  if (data.total === 0) return <StockEmptyCard title="Nothing to pay" description="Invoiced orders show here until they are paid." />;

  const suppliers = Array.from(new Map(data.orders.map((o) => [o.supplier.id, o.supplier.name])).entries());
  const rows = data.orders
    .filter((o) => !search || `${o.reference ?? ''} ${o.supplier.name} ${o.invoice?.number ?? ''}`.toLowerCase().includes(search.toLowerCase()))
    .filter((o) => !supplierId || o.supplier.id === supplierId)
    .filter((o) => due === 'any' || (due === 'overdue' && (o.dueInDays ?? 0) < 0 && !o.invoice?.disputed) || (due === 'week' && (o.dueInDays ?? 99) <= 7) || (due === 'disputed' && o.invoice?.disputed))
    .sort((a, b) => Number(!!a.invoice?.disputed) - Number(!!b.invoice?.disputed) || (a.dueInDays ?? 999) - (b.dueInDays ?? 999));
  const owing = rows.reduce((t, o) => t + Number.parseFloat(o.invoice?.balance ?? '0'), 0);

  return (
    <Frame>
      <div className="flex items-center gap-2">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, invoice or supplier" aria-label="Search order, invoice or supplier" shortcutHint="" className="w-[260px]" />
        <Select label="Supplier:" value={supplierId} onChange={setSupplierId} aria="Filter by supplier" options={[['', 'All'], ...suppliers]} />
        <Select
          label="Due:"
          value={due}
          onChange={setDue}
          aria="Filter by due date"
          options={[
            ['any', 'Any time'],
            ['overdue', 'Overdue'],
            ['week', 'Within 7 days'],
            ['disputed', 'Disputed'],
          ]}
        />
        <span className="ml-auto font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.04em] text-wds-text-secondary">
          {rows.length} invoice{rows.length === 1 ? '' : 's'}
          {showMoney ? ` · KES ${kes(owing)} to pay` : ''}
        </span>
      </div>

      {rows.length === 0 ? (
        <StockEmptyCard
          title="No invoices match"
          description="Try a different search or filter."
          actionLabel="Clear filters"
          onAction={() => {
            setSearch('');
            setSupplierId('');
            setDue('any');
          }}
        />
      ) : (
        <div className="flex flex-col">
          <div className="flex h-[30px] shrink-0 items-center gap-4 border-b border-wds-neutral-950">
            <span className={cn(thClass, 'w-[84px] shrink-0')}>Order</span>
            <span className={cn(thClass, 'grow')}>Supplier · invoice</span>
            <span className={cn(thClass, 'w-[112px] shrink-0')}>Stage</span>
            {showMoney ? <span className={cn(thClass, 'w-[80px] shrink-0 text-right')}>Invoiced</span> : null}
            {showMoney ? <span className={cn(thClass, 'w-[80px] shrink-0 text-right')}>Advance</span> : null}
            {showMoney ? <span className={cn(thClass, 'w-[90px] shrink-0 text-right')}>Balance due</span> : null}
            <span className={cn(thClass, 'w-[190px] shrink-0')}>Due</span>
            <span className="w-[72px] shrink-0" />
          </div>
          {rows.map((o) => {
            const d = dueOf(o);
            const advance = o.invoice ? Number.parseFloat(o.invoice.advanceApplied) : 0;
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
                <span className="w-[84px] shrink-0 font-wds-mono text-wds-caption text-wds-neutral-950">{o.reference}</span>
                <div className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="truncate font-wds-sans text-wds-body-sm leading-4 text-wds-neutral-950">{o.supplier.name}</span>
                  <span className="truncate font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">
                    {o.invoice?.number} · {dayMonth(o.invoice?.date)}
                  </span>
                </div>
                <StageDots status={o.status} label={o.invoice?.disputed ? 'Disputed' : 'Awaiting payment'} tone={o.invoice?.disputed ? 'error' : 'muted'} />
                {showMoney ? <span className="w-[80px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-secondary">{kes(o.invoice?.amount)}</span> : null}
                {showMoney ? <span className={cn('w-[80px] shrink-0 text-right font-wds-mono text-wds-body-sm', advance > 0 ? 'text-wds-info-fg' : 'text-wds-text-faint')}>{advance > 0 ? `−${kes(advance)}` : '—'}</span> : null}
                {showMoney ? <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-body-sm font-medium text-wds-neutral-950">{kes(o.invoice?.balance)}</span> : null}
                <span className="w-[190px] shrink-0">{d ? <DotLabel tone={d.tone}>{d.text}</DotLabel> : null}</span>
                <div className="flex w-[72px] shrink-0 justify-end" onClick={(e) => e.stopPropagation()}>
                  {o.can.recordPayment ? (
                    <Button size="sm" variant={d?.soon ? 'primary' : 'secondary'} onClick={() => setPayFor(o.id)}>
                      Pay
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
      <RecordPaymentSheet orderId={payFor} onClose={() => setPayFor(null)} />
    </Frame>
  );
}
