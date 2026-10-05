'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Checkbox } from '@/components/ui2/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui2/dropdown-menu';
import { SearchInput } from '@/components/ui2/search-input';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { StockEmptyCard, StockErrorCard, SkeletonRows, TableRowSkeleton } from '../../_shared/components/stock-states';
import { useLoader } from '../../_shared/hooks/use-async';
import { dayMonth, kes, qty as fmtQty } from '../lib/format';
import { usePurchasing } from '../hooks/use-purchasing';
import type { NeedsLine, NeedsRestocking } from '../types';
import { DotLabel, SegmentedToggle, thClass } from './parts';

/**
 * Tab 1: what is low or out, grouped by supplier (Paper `01`) or listed by item (`02`). Tick lines, change who to buy from
 * and how much, then create the order. One supplier opens New order; several create one draft each (decision Q-08).
 */
interface Override {
  supplierId?: string;
  qty?: string;
}

interface Row {
  line: NeedsLine;
  supplierId: string | null;
  qty: number;
  price: number | null;
  hasLine: boolean;
  total: number | null;
}

const COLS = 'gap-3 px-4';

export function NeedsRestockingTab({ canOrder }: { canOrder: boolean }) {
  const router = useRouter();
  const { service, data: tick, can, ready } = usePurchasing();
  const addToast = useWdsToastStore((s) => s.addToast);
  const showMoney = can('payables.read');
  const [view, setView] = React.useState<'supplier' | 'item'>('supplier');
  const [search, setSearch] = React.useState('');
  const [supplierFilter, setSupplierFilter] = React.useState<string>('');
  const [sort, setSort] = React.useState<'urgent' | 'name' | 'value'>('urgent');
  const [overrides, setOverrides] = React.useState<Record<string, Override>>({});
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  const { data, status, error, reload } = useLoader<NeedsRestocking>(ready ? 'needs' : null,() => service.getNeedsRestocking({}), 'We could not load what needs restocking.');
  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;
  React.useEffect(() => {
    void reloadRef.current();
  }, [tick, service]);

  const rows: Row[] = React.useMemo(() => {
    if (!data) return [];
    return data.groups
      .flatMap((g) => g.lines)
      .map((line): Row => {
        const ov = overrides[line.inventoryItemId];
        const supplierId = ov?.supplierId ?? line.chosenSupplierId;
        const opt = line.supplierOptions.find((o) => o.supplierId === supplierId);
        const q = Number.parseFloat(ov?.qty ?? line.suggestedQty ?? '0') || 0;
        const price = opt && opt.lastPrice !== '' ? Number.parseFloat(opt.lastPrice) : null;
        return { line, supplierId, qty: q, price, hasLine: Boolean(opt), total: price === null ? null : price * q };
      });
  }, [data, overrides]);

  const orderable = (r: Row): boolean => r.hasLine && r.qty > 0;
  const setOv = (id: string, patch: Override): void => setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const toggle = (id: string): void =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (status === 'loading' || (status === 'idle' && !data)) {
    return (
      <div className="flex flex-col rounded-wds-md border border-wds-border bg-wds-surface" aria-busy>
        <SkeletonRows count={6} label="Loading what needs restocking">
          {(i) => <TableRowSkeleton key={i} />}
        </SkeletonRows>
      </div>
    );
  }
  if (status === 'error' || !data) {
    return <StockErrorCard title="We couldn't load this" description={error ?? 'Something went wrong. Try again.'} onRetry={() => void reload()} />;
  }
  if (data.itemCount === 0) {
    return <StockEmptyCard title="Nothing needs restocking" description="Every item is at or above its restock level, or already on an open order." />;
  }

  const visibleRows = rows.filter(
    (r) => (!search || r.line.itemName.toLowerCase().includes(search.toLowerCase())) && (!supplierFilter || r.supplierId === supplierFilter)
  );
  const sortedRows =
    view === 'item'
      ? [...visibleRows].sort((a, b) =>
          sort === 'name'
            ? a.line.itemName.localeCompare(b.line.itemName)
            : sort === 'value'
              ? (b.total ?? 0) - (a.total ?? 0)
              : Number(b.line.status === 'OUT') - Number(a.line.status === 'OUT') || Number.parseFloat(a.line.onHand) / Number.parseFloat(a.line.level) - Number.parseFloat(b.line.onHand) / Number.parseFloat(b.line.level)
        )
      : visibleRows;

  const supplierMeta = (id: string | null) => (id ? data.suppliers.find((s) => s.id === id) : undefined);
  const groups = new Map<string, Row[]>();
  for (const r of sortedRows) groups.set(r.supplierId ?? '', [...(groups.get(r.supplierId ?? '') ?? []), r]);
  const groupList = Array.from(groups.entries()).sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : (supplierMeta(a)?.name ?? '').localeCompare(supplierMeta(b)?.name ?? '')));

  const selectedRows = rows.filter((r) => selected.has(r.line.inventoryItemId) && orderable(r));
  const selectedSuppliers = new Set(selectedRows.map((r) => r.supplierId));
  const selectedTotal = selectedRows.reduce((t, r) => t + (r.total ?? 0), 0);

  const linesParam = (rs: Row[]): string => rs.map((r) => `${r.line.inventoryItemId}:${r.qty}`).join(',');
  const goNew = (supplierId: string, rs: Row[]): void => router.push(`/app/inventory/purchasing/new?supplier=${supplierId}&lines=${encodeURIComponent(linesParam(rs))}`);

  const createMany = async (rs: Row[]): Promise<void> => {
    const bySupplier = new Map<string, Row[]>();
    for (const r of rs) bySupplier.set(r.supplierId as string, [...(bySupplier.get(r.supplierId as string) ?? []), r]);
    if (bySupplier.size === 1) {
      const [only] = Array.from(bySupplier.entries());
      if (only) goNew(only[0], only[1]);
      return;
    }
    setBusy(true);
    const failures: string[] = [];
    let made = 0;
    for (const [supplierId, lines] of Array.from(bySupplier.entries())) {
      try {
        await service.createOrder({
          supplierId,
          expectedDate: null,
          supplierNote: null,
          attendantNote: null,
          lines: lines.map((r) => ({ inventoryItemId: r.line.inventoryItemId, qty: String(r.qty), unitPrice: r.price === null ? '' : String(r.price) })),
        });
        made += 1;
      } catch (e) {
        failures.push(`${supplierMeta(supplierId)?.name ?? 'A supplier'}: ${e instanceof Error ? e.message : 'could not be created'}`);
      }
    }
    setBusy(false);
    if (made) {
      addToast({ variant: 'success', title: `${made} draft order${made === 1 ? '' : 's'} created`, description: 'Open each one under Awaiting approval to review and send.' });
      setSelected(new Set());
      router.replace('/app/inventory/purchasing?tab=approval');
    }
    if (failures.length) addToast({ variant: 'error', title: 'Some orders were not created', description: failures.join(' ') });
  };

  const headerCols = (
    <div className={cn('flex h-[30px] shrink-0 items-center border-b border-wds-neutral-950', COLS)}>
      <span className="w-7 shrink-0" />
      <span className={cn(thClass, 'grow')}>Item</span>
      <span className={cn(thClass, 'w-[84px] shrink-0')}>Status</span>
      <span className={cn(thClass, 'w-[130px] shrink-0 text-right')}>On hand / level</span>
      <span className={cn(thClass, 'w-[200px] shrink-0')}>Buy from</span>
      <span className={cn(thClass, 'w-[120px] shrink-0')}>Order qty</span>
      {showMoney ? <span className={cn(thClass, 'w-[90px] shrink-0 text-right')}>Last price</span> : null}
      {showMoney ? <span className={cn(thClass, 'w-[110px] shrink-0 text-right')}>Est. total</span> : null}
    </div>
  );

  const renderRow = (r: Row) => {
    const { line } = r;
    const id = line.inventoryItemId;
    const opt = line.supplierOptions.find((o) => o.supplierId === r.supplierId);
    const better = r.price === null ? [] : line.supplierOptions.filter((o) => o.supplierId !== r.supplierId && o.lastPrice !== '' && Number.parseFloat(o.lastPrice) < (r.price as number));
    const best = [...better].sort((a, b) => Number.parseFloat(a.lastPrice) - Number.parseFloat(b.lastPrice))[0];
    const cheapest = best && r.price !== null ? { name: best.name, by: r.price - Number.parseFloat(best.lastPrice) } : null;
    const others = line.supplierOptions;
    const choices = others.length ? others.map((o) => ({ id: o.supplierId, name: o.name, price: o.lastPrice, last: o.lastBoughtAt, preferred: o.preferred, cheaperBy: o.cheaperBy })) : data.suppliers.map((s) => ({ id: s.id, name: s.name, price: '', last: null, preferred: false, cheaperBy: null }));
    const checked = selected.has(id);
    return (
      <div key={id} className={cn('flex h-14 shrink-0 items-center border-b border-wds-neutral-100', COLS)}>
        <span className="flex w-7 shrink-0 items-center">
          {canOrder ? (
            <Checkbox checked={checked} disabled={!orderable(r)} onCheckedChange={() => toggle(id)} aria-label={`Select ${line.itemName}`} />
          ) : null}
        </span>
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <span className="truncate font-wds-sans text-wds-body-sm leading-4 text-wds-neutral-950">{line.itemName}</span>
          <span className="truncate font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">{line.subLabel}</span>
        </div>
        <span className="w-[84px] shrink-0">
          <DotLabel tone={line.status === 'OUT' ? 'error' : 'warning'}>{line.status === 'OUT' ? 'Out' : 'Low'}</DotLabel>
        </span>
        <span className="w-[130px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-secondary">
          {fmtQty(line.onHand)} / {fmtQty(line.level)} {line.usageUnit}
        </span>
        <div className="flex w-[200px] shrink-0 flex-col gap-[3px]">
          {canOrder ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-7 items-center justify-between gap-2 rounded-[2px] border border-wds-border-strong bg-wds-surface px-2 font-wds-sans text-wds-caption text-wds-neutral-950 outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
                aria-label={`Buy ${line.itemName} from`}
              >
                <span className="truncate">{r.supplierId ? `${(supplierMeta(r.supplierId)?.name ?? '').split(' ')[0]}${showMoney && r.price !== null ? ` · KES ${kes(r.price)}` : ''}` : 'Choose supplier'}</span>
                <ChevronDown className="size-3 shrink-0 text-wds-text-muted" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[280px] p-0">
                {choices.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onSelect={() => setOv(id, { supplierId: c.id })}
                    className="flex items-center justify-between gap-3 rounded-none border-b border-wds-border px-3 py-2.5 last:border-b-0"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="font-wds-sans text-wds-body-sm font-medium leading-4 text-wds-neutral-950">
                        {c.name.split(' ')[0]}
                        {showMoney && c.price ? ` · KES ${kes(c.price)}` : ''}
                      </span>
                      <span className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">{c.last ? `Last bought ${dayMonth(c.last)}` : 'Never bought from them'}</span>
                    </span>
                    {c.preferred ? (
                      <span className="rounded-[2px] border border-wds-espresso-200 bg-white px-[7px] py-0.5 font-wds-sans text-[10px] text-wds-espresso-700">Preferred</span>
                    ) : showMoney && c.cheaperBy ? (
                      <span className="font-wds-sans text-[11px] font-medium text-wds-success-fg">KES {kes(c.cheaperBy)} cheaper</span>
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="font-wds-sans text-wds-caption text-wds-neutral-950">{supplierMeta(r.supplierId)?.name ?? '—'}</span>
          )}
          {showMoney && cheapest ? (
            <span className="font-wds-sans text-[11px] leading-[14px] text-wds-success-fg">
              {cheapest.name.split(' ')[0]} is KES {kes(cheapest.by)} cheaper
            </span>
          ) : null}
        </div>
        <div className="w-[120px] shrink-0">
          <label className="flex h-7 items-center justify-end gap-1.5 rounded-[2px] border border-wds-border-strong bg-wds-surface px-2 focus-within:border-wds-primary focus-within:shadow-wds-ring">
            <input
              inputMode="decimal"
              value={overrides[id]?.qty ?? line.suggestedQty ?? ''}
              placeholder="—"
              disabled={!canOrder || !r.hasLine}
              onChange={(e) => setOv(id, { qty: e.target.value.replace(/[^0-9.]/g, '') })}
              aria-label={`Order quantity for ${line.itemName}`}
              className="w-full min-w-0 bg-transparent text-right font-wds-mono text-wds-caption text-wds-neutral-950 outline-none disabled:opacity-60"
            />
            <span className="shrink-0 font-wds-sans text-[11px] text-wds-text-secondary">{line.buyUnit ?? ''}</span>
          </label>
        </div>
        {showMoney ? <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-secondary">{r.price === null ? '—' : kes(r.price)}</span> : null}
        {showMoney ? <span className="w-[110px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-neutral-950">{r.total === null ? '—' : kes(r.total)}</span> : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 pb-20">
      <div className="flex items-center gap-4">
        <p className="font-wds-sans text-wds-body-sm text-wds-neutral-950">
          {data.itemCount} item{data.itemCount === 1 ? '' : 's'} {data.itemCount === 1 ? 'is' : 'are'} below {data.itemCount === 1 ? 'its' : 'their'} restock level, across {data.supplierCount} supplier{data.supplierCount === 1 ? '' : 's'}.{' '}
          {canOrder ? 'Tick what you want and create the orders.' : ''}
        </p>
        <SegmentedToggle
          label="How to list"
          value={view}
          onChange={setView}
          options={[
            { value: 'supplier', label: 'Group by supplier' },
            { value: 'item', label: 'List by item' },
          ]}
        />
      </div>

      {view === 'item' ? (
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items" aria-label="Search items" shortcutHint="" className="w-[260px]" />
          <label className="flex h-8 items-center gap-1 border border-wds-border-strong bg-white px-3 font-wds-sans text-wds-body-sm text-wds-neutral-950">
            <span className="text-wds-text-secondary">Supplier:</span>
            <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="bg-transparent outline-none" aria-label="Filter by supplier">
              <option value="">All</option>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-8 items-center gap-1 border border-wds-border-strong bg-white px-3 font-wds-sans text-wds-body-sm text-wds-neutral-950">
            <span className="text-wds-text-secondary">Sort:</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="bg-transparent outline-none" aria-label="Sort by">
              <option value="urgent">Most urgent first</option>
              <option value="name">Name</option>
              <option value="value">Highest value</option>
            </select>
          </label>
        </div>
      ) : null}

      {sortedRows.length === 0 ? (
        <StockEmptyCard title="No items match" description="Try a different search or supplier." actionLabel="Clear filters" onAction={() => { setSearch(''); setSupplierFilter(''); }} />
      ) : view === 'item' ? (
        <div className="flex flex-col">
          {headerCols}
          {sortedRows.map(renderRow)}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {headerCols}
          {groupList.map(([sid, rs]) => {
            const meta = supplierMeta(sid || null);
            const ready = rs.filter(orderable);
            const groupTotal = rs.reduce((t, r) => t + (r.total ?? 0), 0);
            const none = sid === '';
            return (
              <div key={sid || 'none'} className={cn('flex flex-col overflow-hidden rounded bg-wds-surface border', none ? 'border-wds-warning-border' : 'border-wds-border')}>
                <div className={cn('flex h-12 shrink-0 items-center border-b', COLS, none ? 'border-wds-warning-border bg-wds-warning-bg' : 'border-wds-border bg-wds-neutral-50')}>
                  <span className="font-wds-sans text-wds-body-sm font-semibold leading-4 text-wds-neutral-950">{none ? 'No supplier yet' : meta?.name}</span>
                  {none ? (
                    <span className="font-wds-sans text-wds-caption text-wds-text-secondary">Choose who to buy these from, then they join that supplier&apos;s order.</span>
                  ) : (
                    <>
                      <span className="font-wds-mono text-[11px] text-wds-text-secondary">{meta?.code}</span>
                      <span className="font-wds-sans text-wds-caption text-wds-text-secondary">{meta?.termsLabel}</span>
                      <span className="ml-auto font-wds-sans text-wds-caption text-wds-text-secondary">
                        {rs.length} item{rs.length === 1 ? '' : 's'}
                        {showMoney ? ` · est. KES ${kes(groupTotal)}` : ''}
                      </span>
                      {canOrder && sid ? (
                        <Button size="sm" disabled={!ready.length || busy} onClick={() => goNew(sid, ready)}>
                          Create order · {ready.length}
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
                {rs.map(renderRow)}
              </div>
            );
          })}
        </div>
      )}

      {canOrder && selectedRows.length > 0 ? (
        <div className="fixed bottom-16 left-[calc(236px+32px)] right-8 z-30 flex h-[52px] items-center gap-4 rounded bg-[#241609] px-5 shadow-[0_8px_24px_#17151240]" role="region" aria-label="Selected items">
          <span className="font-wds-sans text-wds-body-sm text-[#F5F3EF]">
            {selectedRows.length} item{selectedRows.length === 1 ? '' : 's'} selected · {selectedSuppliers.size} supplier{selectedSuppliers.size === 1 ? '' : 's'}
            {showMoney ? ` · est. KES ${kes(selectedTotal)}` : ''}
          </span>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto font-wds-sans text-wds-body-sm text-[#B5AEA5] outline-none hover:text-[#F5F3EF] focus-visible:shadow-wds-ring">
            Clear
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void createMany(selectedRows)}
            className="flex h-[34px] items-center justify-center rounded-[2px] bg-[#F5F3EF] px-[18px] font-wds-sans text-wds-body-sm font-medium text-wds-neutral-950 outline-none transition-opacity hover:opacity-90 focus-visible:shadow-wds-ring disabled:opacity-60"
          >
            {busy ? 'Creating…' : selectedSuppliers.size > 1 ? `Create ${selectedSuppliers.size} orders` : 'Create order'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
