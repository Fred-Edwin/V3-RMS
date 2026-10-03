'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { ApiError, formatApiErrorMessage } from '@/types/api';
import type { InventoryItemListRow } from '../../types';
import { listItems, putSupplierLine } from '../../services';
import { itemPackLabel } from '../../lib/supplier-logic';
import { normalizePriceInput, pricePerUsageUnit, validateOptionalPrice } from '../../lib/item-price';
import { DrawerError, DrawerFrame, PrimaryFooterButton, SecondaryFooterButton } from '../catalog/drawer-parts';
import { SkeletonRows, TableRowSkeleton } from '../stock/stock-states';

/** How many usage units the item's own pack holds, as the catalog line will store it (`null` when none is set). */
const itemHolds = (item: Pick<InventoryItemListRow, 'conversionFactor' | 'packSize'>): string | null => item.conversionFactor ?? item.packSize;


export interface AddItemsViewProps {
  supplierId: string;
  supplierName: string;
  /** Items this supplier already sells (any pack): hidden from the list. */
  soldItemIds: ReadonlySet<string>;
  onCancel: () => void;
  /** At least one line was added. */
  onAdded: (count: number) => void;
}

/**
 * Add several items (Paper step 21): tick what the supplier sells and type their price per pack. Packs come from the item,
 * so each line is saved with the item's own pack; a different pack is added with "Add one". Each ticked item is one PUT on
 * the line key, so adding twice never duplicates. A price may be left empty: the first signed receipt sets it.
 */
export function AddItemsView({ supplierId, supplierName, soldItemIds, onCancel, onAdded }: AddItemsViewProps) {
  const first = supplierName.split(/\s+/)[0] ?? supplierName;
  const [search, setSearch] = React.useState('');
  const [items, setItems] = React.useState<InventoryItemListRow[]>([]);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<Record<string, string>>({});
  const [priceErrors, setPriceErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [failed, setFailed] = React.useState<string[]>([]);
  const latest = React.useRef(0);
  const seen = React.useRef(new Map<string, InventoryItemListRow>());
  const [reloadKey, setReloadKey] = React.useState(0);

  // Search the catalog on the server, debounced; only the newest answer is kept.
  React.useEffect(() => {
    const request = ++latest.current;
    setStatus('loading');
    const timer = setTimeout(async () => {
      try {
        const response = await listItems({ search: search.trim() || undefined, perPage: 100 });
        if (request !== latest.current) return;
        for (const row of response.data) seen.current.set(row.id, row);
        setItems(response.data);
        setStatus('ready');
      } catch (err) {
        if (request !== latest.current) return;
        setError(formatApiErrorMessage(err, 'Could not load the catalog.'));
        setStatus('error');
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search, reloadKey]);

  const rows = items.filter((item) => item.type !== 'PREPPED' && item.retiredAt === null && !soldItemIds.has(item.id));
  const count = Object.keys(picked).length;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = '';
      return next;
    });

  const submit = async () => {
    const errs: Record<string, string> = {};
    for (const [id, price] of Object.entries(picked)) {
      const problem = validateOptionalPrice(price);
      if (problem) errs[id] = problem;
    }
    setPriceErrors(errs);
    if (Object.keys(errs).length > 0 || count === 0) return;

    setSaving(true);
    setFailed([]);
    setError(null);
    const done: string[] = [];
    const problems: string[] = [];
    for (const [id, price] of Object.entries(picked)) {
      const item = seen.current.get(id);
      if (!item) continue;
      try {
        const holds = itemHolds(item);
        await putSupplierLine(supplierId, id, {
          buyUnit: item.buyUnit,
          ...(holds ? { packSize: holds } : {}),
          ...(normalizePriceInput(price) !== '' ? { price: normalizePriceInput(price) } : {}),
        });
        done.push(id);
      } catch (err) {
        problems.push(`${item.name}: ${err instanceof ApiError ? err.message : 'could not be added'}`);
      }
    }
    setSaving(false);
    if (done.length > 0) onAdded(done.length);
    if (problems.length > 0) {
      // Keep only what failed ticked, so a second press retries just those.
      setPicked((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !done.includes(id))));
      setFailed(problems);
    }
  };

  return (
    <DrawerFrame
      eyebrow={supplierName}
      title="Add several items"
      subtitle={`Tick what ${first} sells and type their price per pack. Items they already sell are hidden.`}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span aria-live="polite" className="font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">{count} selected</span>
          <div className="flex gap-2.5">
            <SecondaryFooterButton onClick={onCancel}>Cancel</SecondaryFooterButton>
            <PrimaryFooterButton onClick={submit} disabled={saving || count === 0}>
              {count === 1 ? 'Add 1 item' : `Add ${count} items`}
            </PrimaryFooterButton>
          </div>
        </div>
      }
    >
      {failed.length > 0 ? (
        <DrawerError>
          {failed.length === 1 ? 'One item was not added.' : `${failed.length} items were not added.`} {failed.join(' · ')}
        </DrawerError>
      ) : null}
      {status === 'error' ? (
        <DrawerError>
          {error}{' '}
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="font-medium underline underline-offset-2">
            Try again
          </button>
        </DrawerError>
      ) : null}
      <input
        type="search"
        name="catalogSearch"
        aria-label="Search the catalog"
        placeholder="Search the catalog"
        autoComplete="off"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-[38px] w-full shrink-0 rounded-wds-sm border border-wds-border-strong bg-white px-3 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink placeholder:text-wds-text-faint focus-visible:border-wds-selected-edge focus-visible:shadow-[0_0_0_1px_var(--wds-selected-edge)] focus-visible:outline-none"
      />
      <div role="group" aria-label="Items" className="flex flex-col">
        <div className="flex h-8 shrink-0 items-center border-b border-wds-text-ink">
          <span className="w-[34px] shrink-0" />
          <span className="grow basis-0 font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink">ITEM · THEIR PACK</span>
          <span className="w-[130px] shrink-0 text-right font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink">PRICE · KES</span>
        </div>
        {status === 'loading' && rows.length === 0 ? (
          <SkeletonRows count={5} label="Loading the catalog">
            {(i) => <TableRowSkeleton key={i} className="h-14 px-0" nameWidth={140 + ((i * 29) % 70)} widths={[80]} />}
          </SkeletonRows>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
            {search.trim() ? 'No item matches that search, or they already sell it.' : 'They already sell everything in the catalog.'}
          </p>
        ) : (
          rows.map((item) => {
            const on = item.id in picked;
            const price = picked[item.id] ?? '';
            const per = on ? pricePerUsageUnit(price, itemHolds(item)) : null;
            const holds = itemHolds(item);
            return (
              <label
                key={item.id}
                className={cn(
                  'flex h-14 shrink-0 cursor-pointer items-center border-b border-wds-neutral-100 transition-colors duration-150',
                  on ? '-mx-6 bg-wds-espresso-50 px-6' : 'hover:bg-wds-neutral-50'
                )}
              >
                <span className="flex w-[34px] shrink-0 items-center">
                  <input type="checkbox" checked={on} onChange={() => toggle(item.id)} aria-label={`Select ${item.name}`} className="size-4 accent-[var(--wds-selected-edge)]" />
                </span>
                <span className="flex min-w-0 grow basis-0 flex-col gap-0.5">
                  <span className="truncate font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{item.name}</span>
                  <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">
                    {itemPackLabel(item)}
                    {per !== null && holds && item.buyUnit.toLowerCase() !== item.usageUnit.toLowerCase() ? ` · ${Math.round(per).toLocaleString('en-US')} / ${item.usageUnit}` : ''}
                  </span>
                </span>
                <span className="flex w-[130px] shrink-0 flex-col items-end gap-0.5">
                  <input
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={`Price for ${item.name}`}
                    placeholder="price"
                    disabled={!on}
                    value={price}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPicked((prev) => ({ ...prev, [item.id]: value }));
                      setPriceErrors((prev) => ({ ...prev, [item.id]: '' }));
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-invalid={priceErrors[item.id] ? true : undefined}
                    className={cn(
                      'h-[34px] w-[100px] rounded-wds-sm px-2.5 text-right font-wds-mono text-[13px] leading-4 text-wds-text-ink outline-none transition-colors placeholder:text-wds-text-faint',
                      on ? 'border-[1.5px] border-wds-selected-edge bg-white' : 'border border-wds-border bg-wds-neutral-50',
                      priceErrors[item.id] && 'border-wds-error-fg'
                    )}
                  />
                </span>
              </label>
            );
          })
        )}
      </div>
      {Object.values(priceErrors).some(Boolean) ? (
        <p role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">Enter prices like 3,200 or 380.50, or leave a price empty.</p>
      ) : null}
      <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        Packs come from the item. If {first} sells a different pack, use Add one and tick the pack box.
      </p>
    </DrawerFrame>
  );
}
