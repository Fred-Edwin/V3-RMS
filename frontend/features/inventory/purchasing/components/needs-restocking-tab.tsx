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

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** On hand as a share of the restock level, lowest first; a caller blind to stock figures has none, so order ties stay as they came. */
const coverOf = (l: NeedsLine): number => (l.onHand !== undefined && l.level !== undefined ? Number.parseFloat(l.onHand) / Number.parseFloat(l.level) : 0);

export function NeedsRestockingTab({ canOrder }: { canOrder: boolean }) {
  const router = useRouter();
  const { service, data: tick, can, ready } = usePurchasing();
  const addToast = useWdsToastStore((s) => s.addToast);
  const showPrices = can('catalog.see_costs');
  const [view, setView] = React.useState<'supplier' | 'item'>('supplier');
  const [search, setSearch] = React.useState('');
  const [supplierFilter, setSupplierFilter] = React.useState<string>('');
  const [sort, setSort] = React.useState<'urgent' | 'name' | 'value'>('urgent');
  const [overrides, setOverrides] = React.useState<Record<string, Override>>({});
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [activeKey, setActiveKey] = React.useState<string | null>(null);

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
        const parsed = opt && opt.lastPrice ? Number.parseFloat(opt.lastPrice) : Number.NaN;
        const price = Number.isFinite(parsed) ? parsed : null;
        return { line, supplierId, qty: q, price, hasLine: Boolean(opt), total: price === null ? null : price * q };
      });
  }, [data, overrides]);

  const orderable = (r: Row): boolean => r.hasLine && r.qty > 0;
  // Paper `2WUC`: every line that can be ordered starts ticked, once, when the list first arrives.
  const tickedOnce = React.useRef(false);
  React.useEffect(() => {
    if (tickedOnce.current || rows.length === 0) return;
    tickedOnce.current = true;
    setSelected(new Set(rows.filter((r) => r.hasLine && r.qty > 0).map((r) => r.line.inventoryItemId)));
  }, [rows]);
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

  const supplierMeta = (id: string | null) => (id ? data.suppliers.find((s) => s.id === id) : undefined);
  const needle = search.trim().toLowerCase();
  const visibleRows = rows.filter(
    (r) =>
      (!needle || r.line.itemName.toLowerCase().includes(needle) || (supplierMeta(r.supplierId)?.name ?? '').toLowerCase().includes(needle)) &&
      (!supplierFilter || r.supplierId === supplierFilter)
  );
  const sortedRows =
    view === 'item'
      ? [...visibleRows].sort((a, b) =>
          sort === 'name'
            ? a.line.itemName.localeCompare(b.line.itemName)
            : sort === 'value'
              ? (b.total ?? 0) - (a.total ?? 0)
              : Number(b.line.status === 'OUT') - Number(a.line.status === 'OUT') || coverOf(a.line) - coverOf(b.line)
        )
      : visibleRows;

  const groups = new Map<string, Row[]>();
  for (const r of sortedRows) groups.set(r.supplierId ?? '', [...(groups.get(r.supplierId ?? '') ?? []), r]);
  const groupList = Array.from(groups.entries()).sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : (supplierMeta(a)?.name ?? '').localeCompare(supplierMeta(b)?.name ?? '')));

  const active = groupList.find(([k]) => k === activeKey) ?? groupList[0];
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
      {showPrices ? <span className={cn(thClass, 'w-[90px] shrink-0 text-right')}>Last price</span> : null}
      {showPrices ? <span className={cn(thClass, 'w-[110px] shrink-0 text-right')}>Est. total</span> : null}
    </div>
  );

  /** The "buy from" choices for one line (Paper `04`): the trigger is passed in, so the dropdown and the "Change supplier" link share one menu. */
  const supplierMenu = (line: NeedsLine, trigger: React.ReactNode) => {
    const id = line.inventoryItemId;
    const choices = line.supplierOptions.length
      ? line.supplierOptions.map((o) => ({ id: o.supplierId, name: o.name, price: o.lastPrice, last: o.lastBoughtAt, preferred: o.preferred, cheaperBy: o.cheaperBy }))
      : data.suppliers.map((s) => ({ id: s.id, name: s.name, price: '', last: null, preferred: false, cheaperBy: null }));
    return (
      <DropdownMenu>
        {trigger}
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
                  {showPrices && c.price ? ` · KES ${kes(c.price)}` : ''}
                </span>
                <span className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">{c.last ? `Last bought ${dayMonth(c.last)}` : 'Never bought from them'}</span>
              </span>
              {c.preferred ? (
                <span className="rounded-[2px] border border-wds-espresso-200 bg-white px-[7px] py-0.5 font-wds-sans text-[10px] text-wds-espresso-700">Preferred</span>
              ) : showPrices && c.cheaperBy ? (
                <span className="font-wds-sans text-[11px] font-medium text-wds-success-fg">KES {kes(c.cheaperBy)} cheaper</span>
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  /** One line in the supplier's pane (Paper `2WUC`): tick, item and its status line, suggested, order qty, price, estimate. No supplier dropdown. */
  const renderPaneRow = (r: Row, none: boolean) => {
    const { line } = r;
    const id = line.inventoryItemId;
    const stock = line.onHand !== undefined && line.level !== undefined ? ` · On hand ${fmtQty(line.onHand)} · Restock level ${fmtQty(line.level)}` : '';
    return (
      <div key={id} className="flex min-h-[52px] shrink-0 items-center gap-4 border-b border-wds-neutral-100 px-3 py-[9px]">
        <span className="flex w-5 shrink-0 items-center">
          {canOrder ? <Checkbox checked={selected.has(id)} disabled={!orderable(r)} onCheckedChange={() => toggle(id)} aria-label={`Select ${line.itemName}`} /> : null}
        </span>
        <div className="flex min-w-[200px] grow basis-0 flex-col gap-0.5">
          <span className="truncate font-wds-sans text-wds-body-sm font-medium leading-4 text-wds-neutral-950">{line.itemName}</span>
          <span className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">
            <span className={line.status === 'OUT' ? 'text-wds-error-fg' : 'text-wds-warning-fg'}>{line.status === 'OUT' ? 'Out' : 'Low'}</span>
            {stock}
            {canOrder
              ? supplierMenu(
                  line,
                  <>
                    {' · '}
                    <DropdownMenuTrigger className="rounded-[2px] font-wds-sans text-[11px] leading-[14px] text-wds-caramel-600 outline-none hover:underline focus-visible:shadow-wds-ring" aria-label={`${none ? 'Choose' : 'Change'} supplier for ${line.itemName}`}>
                      {none ? 'Choose supplier' : 'Change supplier'}
                    </DropdownMenuTrigger>
                  </>
                )
              : null}
          </span>
        </div>
        <span className="w-[96px] shrink-0 font-wds-mono text-wds-caption text-wds-text-secondary">{line.suggestedQty ? `${fmtQty(line.suggestedQty)} ${line.buyUnit ?? ''}` : '—'}</span>
        <div className="w-[120px] shrink-0">
          {canOrder ? (
            <label className="flex h-7 items-center justify-end gap-1.5 rounded-[2px] border border-wds-border-strong bg-wds-surface px-2 focus-within:border-wds-primary focus-within:shadow-wds-ring">
              <input
                inputMode="decimal"
                value={overrides[id]?.qty ?? line.suggestedQty ?? ''}
                placeholder="—"
                disabled={!r.hasLine}
                onChange={(e) => setOv(id, { qty: e.target.value.replace(/[^0-9.]/g, '') })}
                aria-label={`Order quantity for ${line.itemName}`}
                className="w-full min-w-0 bg-transparent text-right font-wds-mono text-wds-caption text-wds-neutral-950 outline-none disabled:opacity-60"
              />
              <span className="shrink-0 font-wds-sans text-[11px] text-wds-text-secondary">{line.buyUnit ?? ''}</span>
            </label>
          ) : (
            <span className="font-wds-mono text-wds-caption text-wds-neutral-950">{r.qty > 0 ? `${fmtQty(String(r.qty))} ${line.buyUnit ?? ''}` : '—'}</span>
          )}
        </div>
        {showPrices ? <span className="w-[80px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-secondary">{r.price === null ? '—' : kes(r.price)}</span> : null}
        {showPrices ? <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-neutral-950">{r.total === null ? '—' : kes(r.total)}</span> : null}
      </div>
    );
  };

  const renderRow = (r: Row) => {
    const { line } = r;
    const id = line.inventoryItemId;
    const better = r.price === null ? [] : line.supplierOptions.filter((o) => o.supplierId !== r.supplierId && o.lastPrice !== '' && Number.parseFloat(o.lastPrice) < (r.price as number));
    const best = [...better].sort((a, b) => Number.parseFloat(a.lastPrice) - Number.parseFloat(b.lastPrice))[0];
    const cheapest = best && r.price !== null ? { name: best.name, by: r.price - Number.parseFloat(best.lastPrice) } : null;
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
          {line.onHand !== undefined && line.level !== undefined ? `${fmtQty(line.onHand)} / ${fmtQty(line.level)} ${line.usageUnit}` : '—'}
        </span>
        <div className="flex w-[200px] shrink-0 flex-col gap-[3px]">
          {canOrder ? (
            supplierMenu(
              line,
              <DropdownMenuTrigger
                className="flex h-7 items-center justify-between gap-2 rounded-[2px] border border-wds-border-strong bg-wds-surface px-2 font-wds-sans text-wds-caption text-wds-neutral-950 outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring"
                aria-label={`Buy ${line.itemName} from`}
              >
                <span className="truncate">{r.supplierId ? `${(supplierMeta(r.supplierId)?.name ?? '').split(' ')[0]}${showPrices && r.price !== null ? ` · KES ${kes(r.price)}` : ''}` : 'Choose supplier'}</span>
                <ChevronDown className="size-3 shrink-0 text-wds-text-muted" aria-hidden />
              </DropdownMenuTrigger>
            )
          ) : (
            <span className="font-wds-sans text-wds-caption text-wds-neutral-950">{supplierMeta(r.supplierId)?.name ?? '—'}</span>
          )}
          {showPrices && cheapest ? (
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
        {showPrices ? <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-secondary">{r.price === null ? '—' : kes(r.price)}</span> : null}
        {showPrices ? <span className="w-[110px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-neutral-950">{r.total === null ? '—' : kes(r.total)}</span> : null}
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
      </div>

      <div className="flex items-center gap-2">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item or supplier" aria-label="Search item or supplier" shortcutHint="" className="w-[260px]" />
        {view === 'item' ? (
          <>
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
          </>
        ) : null}
        <SegmentedToggle
          label="How to list"
          value={view}
          onChange={setView}
          options={[
            { value: 'supplier', label: 'By supplier' },
            { value: 'item', label: 'By item' },
          ]}
        />
      </div>

      {sortedRows.length === 0 ? (
        <StockEmptyCard title="No items match" description="Try a different search or supplier." actionLabel="Clear filters" onAction={() => { setSearch(''); setSupplierFilter(''); }} />
      ) : view === 'item' ? (
        <div className="flex flex-col">
          {headerCols}
          {sortedRows.map(renderRow)}
        </div>
      ) : (
        <div className="flex items-stretch border-t border-wds-neutral-950">
          <div className="flex w-[300px] shrink-0 flex-col border-r border-wds-neutral-950" role="tablist" aria-orientation="vertical" aria-label="Buy from">
            <div className="border-b border-wds-neutral-950 px-4 py-3 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-muted">
              Buy from · {plural(groupList.filter(([k]) => k !== '').length, 'supplier')}
            </div>
            {groupList.map(([sid, rs]) => {
              const none = sid === '';
              const on = sid === (active?.[0] ?? '');
              const outCount = rs.filter((r) => r.line.status === 'OUT').length;
              const priced = rs.every((r) => r.total !== null);
              const total = rs.reduce((t, r) => t + (r.total ?? 0), 0);
              return (
                <button
                  key={sid || 'none'}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActiveKey(sid)}
                  className={cn(
                    'flex flex-col gap-[3px] border-b border-wds-border py-3 pl-[19px] pr-4 text-left outline-none focus-visible:shadow-wds-ring',
                    on ? 'bg-wds-caramel-100 shadow-[inset_3px_0_0_var(--wds-caramel-500)]' : 'hover:bg-wds-neutral-50'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn('size-2 shrink-0 rounded-full', none ? 'border-[1.5px] border-wds-text-faint' : outCount > 0 ? 'bg-wds-error-fg' : 'bg-wds-warning-fg')} aria-hidden />
                    <span className={cn('grow truncate font-wds-sans text-wds-body-sm', on ? 'font-semibold' : 'font-medium', none ? 'text-wds-text-muted' : 'text-wds-neutral-950')}>
                      {none ? 'No supplier yet' : (supplierMeta(sid)?.name ?? '')}
                    </span>
                    {showPrices ? <span className={cn('font-wds-mono text-wds-body-sm', none || !priced ? 'text-wds-text-faint' : 'text-wds-neutral-950')}>{none ? '·' : priced ? kes(total) : '—'}</span> : null}
                  </span>
                  <span className="flex justify-between pl-4 font-wds-sans text-wds-caption text-wds-text-muted">
                    <span>{plural(rs.length, 'item')}{none ? ' · choose who to buy from' : showPrices && !priced ? ' · no price yet' : ''}</span>
                    {outCount > 0 ? <span className="text-wds-error-fg">{outCount} out</span> : null}
                  </span>
                </button>
              );
            })}
            {canOrder ? (
              <div className="flex justify-between bg-wds-neutral-50 px-4 py-3">
                <span className="font-wds-sans text-wds-caption text-wds-text-muted">Ticked · {plural(selectedRows.length, 'item')}</span>
                {showPrices ? <span className="font-wds-mono text-wds-body-sm font-semibold text-wds-neutral-950">{kes(selectedTotal)}</span> : null}
              </div>
            ) : null}
          </div>

          {active ? (
            <div className="flex min-w-0 grow flex-col overflow-x-auto">
              {(() => {
                const [sid, rs] = active;
                const none = sid === '';
                const meta = supplierMeta(sid || null);
                const ready = rs.filter((r) => orderable(r) && selected.has(r.line.inventoryItemId));
                const groupTotal = rs.reduce((t, r) => t + (r.total ?? 0), 0);
                return (
                  <>
                    <div className="flex items-end justify-between gap-4 border-b border-wds-border px-3 pb-3.5 pt-4">
                      <div className="flex min-w-0 flex-col gap-[3px]">
                        <h2 className="truncate font-wds-sans text-[20px] font-semibold leading-[26px] tracking-tight text-wds-neutral-950">{none ? 'No supplier yet' : meta?.name}</h2>
                        <p className="font-wds-sans text-wds-caption text-wds-text-muted">
                          {none ? 'Choose who to buy these from, then they join that supplier’s order.' : [plural(rs.length, 'item'), meta?.termsLabel, meta?.code].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {!none ? (
                        <div className="flex shrink-0 items-center gap-5">
                          {showPrices ? <span className="font-wds-mono text-[16px] leading-5 text-wds-neutral-950">KES {rs.some((r) => r.total !== null) ? kes(groupTotal) : '—'}</span> : null}
                          {canOrder ? (
                            <Button size="sm" disabled={!ready.length || busy} onClick={() => goNew(sid, ready)}>
                              Create order · {ready.length}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex h-[30px] shrink-0 items-center gap-4 border-b border-wds-neutral-950 px-3">
                      <span className="w-5 shrink-0" />
                      <span className={cn(thClass, 'min-w-[200px] grow basis-0')}>Item</span>
                      <span className={cn(thClass, 'w-[96px] shrink-0')}>Suggested</span>
                      <span className={cn(thClass, 'w-[120px] shrink-0')}>Order qty</span>
                      {showPrices ? <span className={cn(thClass, 'w-[80px] shrink-0 text-right')}>Price</span> : null}
                      {showPrices ? <span className={cn(thClass, 'w-[90px] shrink-0 text-right')}>Est. (KES)</span> : null}
                    </div>
                    {rs.map((r) => renderPaneRow(r, none))}
                  </>
                );
              })()}
            </div>
          ) : null}
        </div>
      )}

      {canOrder && view === 'item' && selectedRows.length > 0 ? (
        <div className="fixed bottom-16 left-[calc(236px+32px)] right-8 z-30 flex h-[52px] items-center gap-4 rounded bg-[#241609] px-5 shadow-[0_8px_24px_#17151240]" role="region" aria-label="Selected items">
          <span className="font-wds-sans text-wds-body-sm text-[#F5F3EF]">
            {selectedRows.length} item{selectedRows.length === 1 ? '' : 's'} selected · {selectedSuppliers.size} supplier{selectedSuppliers.size === 1 ? '' : 's'}
            {showPrices ? ` · est. KES ${kes(selectedTotal)}` : ''}
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
