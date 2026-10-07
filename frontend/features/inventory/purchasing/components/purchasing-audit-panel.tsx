'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Input } from '@/components/ui2/input';
import { SkeletonRows, StockEmptyCard, StockErrorCard, TableRowSkeleton } from '../../_shared/components/stock-states';
import { useLoader } from '../../_shared/hooks/use-async';
import { usePurchasing } from '../hooks/use-purchasing';
import { dayMonth } from '../lib/format';
import type { AuditRow } from '../types';
import { thClass } from './parts';

const PER_PAGE = 9;
const time = (iso: string): string => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const FIELD = 'flex flex-col gap-1';
const LABEL = 'font-wds-mono text-[10px] uppercase tracking-[0.06em] text-wds-text-secondary';
const SELECT = 'h-8 border border-wds-border-strong bg-white px-2.5 font-wds-sans text-[13px] text-wds-text-ink outline-none focus-visible:shadow-wds-ring';

/** The dot beside the action: blue for money, brown for orders, green for goods. */
const dotFor = (a: AuditRow): string => (a.area === 'Payments' ? 'bg-wds-info-fg' : /received/i.test(a.action) ? 'bg-wds-success-fg' : 'bg-wds-warning-fg');

/**
 * Audit log, Purchasing and payments (Paper `23`): every purchasing and payment action in date order, with who and their role, the
 * action, the document and what changed. Entries cannot be edited or deleted. Search, person, area, action and dates filter it;
 * Export CSV downloads what is shown. The Accountant sees the whole log, including payment and invoice actions.
 */
export function PurchasingAuditPanel({ initialQuery = '' }: { initialQuery?: string }) {
  const { service, data: tick, ready } = usePurchasing();
  const { data, status, error, reload } = useLoader<AuditRow[]>(ready ? 'purchasing-audit' : null, () => service.getAuditLog(), 'We could not load the audit log.');
  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;
  React.useEffect(() => {
    void reloadRef.current();
  }, [tick, service]);

  const [q, setQ] = React.useState(initialQuery);
  const [person, setPerson] = React.useState('');
  const [area, setArea] = React.useState('');
  const [action, setAction] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setQ(initialQuery), [initialQuery]);

  const people = React.useMemo(() => Array.from(new Map((data ?? []).map((r) => [r.actor.id, r.actor.name])).entries()), [data]);
  const actions = React.useMemo(() => Array.from(new Set((data ?? []).map((r) => r.action))).sort(), [data]);
  const rows = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter(
      (r) =>
        (!needle || `${r.document ?? ''} ${r.orderReference ?? ''} ${r.actor.name} ${r.action} ${r.detail} ${r.supplierName}`.toLowerCase().includes(needle)) &&
        (!person || r.actor.id === person) &&
        (!area || r.area === area) &&
        (!action || r.action === action) &&
        (!from || r.at.slice(0, 10) >= from) &&
        (!to || r.at.slice(0, 10) <= to)
    );
  }, [data, q, person, area, action, from, to]);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const shown = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  React.useEffect(() => setPage(1), [q, person, area, action, from, to]);

  const exportCsv = (): void => {
    const quote = (v: string): string => `"${v.replaceAll('"', '""')}"`;
    const csv = [['When', 'Who', 'Role', 'Action', 'Area', 'Document', 'What changed'], ...rows.map((r) => [r.at, r.actor.name, r.actor.role, r.action, r.area, r.document ?? '', r.detail])].map((r) => r.map(quote).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'purchasing-audit-log.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (status === 'error') return <StockErrorCard title="Couldn’t load the audit log" description={error ?? 'Try again.'} onRetry={() => void reload()} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className={cn(FIELD, 'min-w-[240px] grow')}>
          <span className={LABEL}>Search</span>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Document number, person or keyword" aria-label="Search" className="h-8" />
        </label>
        <label className={FIELD}>
          <span className={LABEL}>Person</span>
          <select value={person} onChange={(e) => setPerson(e.target.value)} className={SELECT} aria-label="Person">
            <option value="">Anyone</option>
            {people.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD}>
          <span className={LABEL}>Area</span>
          <select value={area} onChange={(e) => setArea(e.target.value)} className={SELECT} aria-label="Area">
            <option value="">All areas</option>
            <option value="Purchasing">Purchasing</option>
            <option value="Payments">Payments</option>
          </select>
        </label>
        <label className={FIELD}>
          <span className={LABEL}>Action</span>
          <select value={action} onChange={(e) => setAction(e.target.value)} className={SELECT} aria-label="Action">
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD}>
          <span className={LABEL}>From</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-[140px] font-wds-mono" aria-label="From" />
        </label>
        <label className={FIELD}>
          <span className={LABEL}>To</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-[140px] font-wds-mono" aria-label="To" />
        </label>
        <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </Button>
      </div>

      {!data ? (
        <SkeletonRows count={6} label="Loading the audit log">
          {(i) => <TableRowSkeleton key={i} />}
        </SkeletonRows>
      ) : rows.length === 0 ? (
        <StockEmptyCard
          title={data.length === 0 ? 'Nothing has happened yet' : 'Nothing matches'}
          description={data.length === 0 ? 'Orders, deliveries, invoices and payments show here as they happen.' : 'Try a different search or filter.'}
          actionLabel={data.length === 0 ? undefined : 'Clear filters'}
          onAction={data.length === 0 ? undefined : () => { setQ(''); setPerson(''); setArea(''); setAction(''); setFrom(''); setTo(''); }}
        />
      ) : (
        <div className="flex flex-col">
          <div className="flex h-[34px] items-center gap-4 border-b border-wds-text-ink">
            <span className={cn(thClass, 'w-[70px] shrink-0')}>When</span>
            <span className={cn(thClass, 'w-[170px] shrink-0')}>Who</span>
            <span className={cn(thClass, 'w-[220px] shrink-0')}>Action</span>
            <span className={cn(thClass, 'w-[110px] shrink-0')}>Document</span>
            <span className={cn(thClass, 'grow')}>What changed</span>
          </div>
          {shown.map((r) => (
            <div key={r.id} className="flex min-h-12 items-center gap-4 border-b border-wds-neutral-100 py-2">
              <div className="flex w-[70px] shrink-0 flex-col">
                <span className="font-wds-mono text-[12px] leading-4 text-wds-text-ink">{dayMonth(r.at)}</span>
                <span className="font-wds-mono text-[11px] leading-4 text-wds-text-secondary">{time(r.at)}</span>
              </div>
              <div className="flex w-[170px] shrink-0 flex-col">
                <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{r.actor.name}</span>
                <span className="font-wds-sans text-[11px] leading-4 text-wds-text-secondary">{r.actor.role}</span>
              </div>
              <span className="flex w-[220px] shrink-0 items-center gap-2 font-wds-sans text-[13px] text-wds-text-ink">
                <span className={cn('size-1.5 shrink-0 rounded-full', dotFor(r))} aria-hidden />
                {r.action}
              </span>
              <Link href={`/app/inventory/purchasing/${r.orderId}`} className="w-[110px] shrink-0 font-wds-mono text-[12px] text-wds-text-ink underline-offset-2 outline-none hover:underline focus-visible:shadow-wds-ring">
                {r.document ?? r.orderReference ?? 'Open'}
              </Link>
              <span className="min-w-0 grow font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{r.detail}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          {rows.length > 0 ? `Showing ${(page - 1) * PER_PAGE + 1} to ${Math.min(page * PER_PAGE, rows.length)} of ${rows.length} entries. ` : ''}Entries can’t be edited or deleted.
        </p>
        {pages > 1 ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="font-wds-mono text-[12px] text-wds-text-secondary">
              {page} of {pages}
            </span>
            <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
