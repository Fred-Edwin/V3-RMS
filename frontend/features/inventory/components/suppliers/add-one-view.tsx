'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { formatApiErrorMessage } from '@/types/api';
import type { InventoryItemDetail, InventoryItemListRow } from '../../types';
import { getItem, listItems } from '../../services';
import { formatHowWeBuy } from '../../lib/item-format';
import { AddSellerView } from '../catalog/add-seller-view';
import { DrawerError, DrawerFrame, SecondaryFooterButton } from '../catalog/drawer-parts';
import { StockErrorCard, SkeletonRows, TableRowSkeleton } from '../stock/stock-states';

export interface AddOneViewProps {
  supplierId: string;
  supplierName: string;
  /** Start on this item (from the "Pack not on file" notice), skipping the picker. */
  presetItemId?: string;
  onCancel: () => void;
  onAdded: () => void;
}

/**
 * Add one: choose the item, then the same "Add who sells it" form the item page uses, with this supplier fixed. That form
 * carries their name and code, the price, and the "different pack" box that gives a pack its own line.
 */
export function AddOneView({ supplierId, supplierName, presetItemId, onCancel, onAdded }: AddOneViewProps) {
  const [itemId, setItemId] = React.useState<string | null>(presetItemId ?? null);
  const [item, setItem] = React.useState<InventoryItemDetail | null>(null);
  const [itemError, setItemError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [rows, setRows] = React.useState<InventoryItemListRow[]>([]);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [listError, setListError] = React.useState<string | null>(null);
  const latest = React.useRef(0);

  React.useEffect(() => {
    if (itemId) return;
    const request = ++latest.current;
    setStatus('loading');
    const timer = setTimeout(async () => {
      try {
        const response = await listItems({ search: search.trim() || undefined, perPage: 30 });
        if (request !== latest.current) return;
        setRows(response.data.filter((r) => r.type !== 'PREPPED' && r.retiredAt === null));
        setStatus('ready');
      } catch (err) {
        if (request !== latest.current) return;
        setListError(formatApiErrorMessage(err, 'Could not load the catalog.'));
        setStatus('error');
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search, itemId]);

  React.useEffect(() => {
    if (!itemId) {
      setItem(null);
      return;
    }
    let cancelled = false;
    setItemError(null);
    getItem(itemId)
      .then((found) => !cancelled && setItem(found))
      .catch((err) => !cancelled && setItemError(formatApiErrorMessage(err, 'Could not load this item.')));
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  if (itemId && item) {
    return (
      <AddSellerView
        item={item}
        suppliers={[]}
        suppliersLoading={false}
        suppliersError={null}
        onRetrySuppliers={() => undefined}
        onCancel={presetItemId ? onCancel : () => setItemId(null)}
        onAdded={onAdded}
        fixedSupplier={{ id: supplierId, name: supplierName }}
      />
    );
  }

  if (itemId) {
    return (
      <DrawerFrame eyebrow={supplierName} title="Add one" footer={<SecondaryFooterButton onClick={onCancel}>Cancel</SecondaryFooterButton>}>
        {itemError ? (
          <DrawerError>{itemError}</DrawerError>
        ) : (
          <div role="status" aria-live="polite" className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
            Loading the item…
          </div>
        )}
      </DrawerFrame>
    );
  }

  return (
    <DrawerFrame
      eyebrow={supplierName}
      title="Add one"
      subtitle="Choose the item. Then give their name, code, pack and price."
      footer={<SecondaryFooterButton onClick={onCancel}>Cancel</SecondaryFooterButton>}
    >
      <input
        type="search"
        name="itemSearch"
        aria-label="Search the catalog"
        placeholder="Search the catalog"
        autoComplete="off"
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-[38px] w-full shrink-0 rounded-wds-sm border border-wds-border-strong bg-white px-3 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink placeholder:text-wds-text-faint focus-visible:border-wds-selected-edge focus-visible:shadow-[0_0_0_1px_var(--wds-selected-edge)] focus-visible:outline-none"
      />
      {status === 'error' ? (
        <StockErrorCard title="Couldn’t load the catalog" description={listError ?? 'Try again.'} onRetry={() => setSearch((s) => s + '')} />
      ) : status === 'loading' && rows.length === 0 ? (
        <SkeletonRows count={5} label="Loading the catalog">
          {(i) => <TableRowSkeleton key={i} className="h-12 px-0" nameWidth={150 + ((i * 31) % 60)} widths={[90]} />}
        </SkeletonRows>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">No item matches that search.</p>
      ) : (
        <div className="flex flex-col">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setItemId(row.id)}
              className={cn(
                'flex min-h-[48px] items-center justify-between gap-3 border-b border-wds-neutral-100 text-left transition-colors duration-150',
                'hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]'
              )}
            >
              <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{row.name}</span>
              <span className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{formatHowWeBuy(row)}</span>
            </button>
          ))}
        </div>
      )}
    </DrawerFrame>
  );
}
