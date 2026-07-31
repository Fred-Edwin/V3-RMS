'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Card, HelpTip, IconTile } from '@/components/ui';
import { EmptyState } from '@/components/ui';
import { itemTypeLabel, resolveItemIcon } from '@/components/inventory/item-type-icon';
import {
  getCentralStoreLocation,
  getInventoryItemTransactions,
  listInventoryItems,
} from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import { cn } from '@/lib/cn';
import { formatBuyUnitQuantity, formatBuyUnitCost } from '@/lib/inventory-format';
import type { InventoryItem, InventoryItemType, InventoryTransaction } from '@/types/inventory';
import { StockOnHandDesktop } from './StockOnHandDesktop';

type TypeFilter = 'ALL' | InventoryItemType;

const TRANSACTION_LABELS: Record<InventoryTransaction['type'], string> = {
  RECEIVE: 'Received',
  PREP_CONSUME: 'Used in Prep',
  PREP_PRODUCE: 'Prep Output',
  WASTE: 'Waste',
  ADJUSTMENT: 'Count Adjustment',
  DISPATCH_OUT: 'Dispatched Out',
  DISPATCH_IN: 'Dispatched In',
  MARKET_RECEIVE: 'Market Receive',
  SALE: 'Sale',
};

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'ALL', label: 'All Items' },
  { value: 'RAW', label: 'Raw Ingredient' },
  { value: 'PREPPED', label: 'Prepped' },
  { value: 'PASS_THROUGH', label: 'Pass-Through' },
];

const isLowStock = (item: InventoryItem): boolean => {
  if (item.onHandQty === undefined) return false;
  return parseFloat(item.onHandQty) <= parseFloat(item.reorderLevel);
};

const formatQty = (qty: string | undefined): string => {
  if (qty === undefined) return '—';
  const n = parseFloat(qty);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

export default function StockOnHandPage(): JSX.Element {
  const role = useAuthStore((state) => state.role);
  if (role === 'STORE_MANAGER') {
    return <StockOnHandManagerDispatch />;
  }
  return <StockOnHandMobile isManager={false} />;
}

// STORE_MANAGER's dual shell mounts both the desktop sidebar copy and the
// CSS-hidden mobile copy simultaneously (see lib/shell-context.tsx) — each
// branch below checks its own shell context and renders null when it's not
// the one actually visible, so only one ever fetches/renders at a time.
function StockOnHandManagerDispatch(): JSX.Element {
  const isDesktop = useIsDesktopShell();
  if (isDesktop) return <StockOnHandDesktop />;
  return <StockOnHandMobile isManager />;
}

// Manager mobile reuses the same card-list layout Session 6 built for
// Attendant (§8.1 row 1: "Same card list view as Manager's mobile layout")
// — the only difference is Manager cards are tappable into a full-screen
// movement history feed (§8.1 row 1 mobile column), while Attendant's stay
// read-only with no drill-down, per §8.2 row 1.
function StockOnHandMobile({ isManager }: { isManager: boolean }): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [locationId, setLocationId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  const loadItems = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const location = await getCentralStoreLocation(accessToken);
      if (!location) {
        toast({ variant: 'error', title: 'Central Store not set up', message: 'No Central Store location was found for this organization.' });
        setItems([]);
        return;
      }
      setLocationId(location.id);
      const result = await listInventoryItems(accessToken, { locationId: location.id, isActive: true });
      setItems(result);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load stock', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const openMovementHistory = useCallback(
    async (item: InventoryItem) => {
      if (!isManager || !accessToken || !locationId) return;
      setSelectedItem(item);
      setIsLoadingTransactions(true);
      try {
        const result = await getInventoryItemTransactions(item.id, locationId, accessToken);
        setTransactions(result);
      } catch (error) {
        toast({ variant: 'error', title: 'Failed to load movement history', message: error instanceof Error ? error.message : 'Please try again.' });
      } finally {
        setIsLoadingTransactions(false);
      }
    },
    [isManager, accessToken, locationId, toast],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((item) => typeFilter === 'ALL' || item.type === typeFilter)
      .filter((item) => !q || item.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, typeFilter, search]);

  const lowStockCount = useMemo(() => items.filter(isLowStock).length, [items]);

  return (
    <div className="min-h-full bg-crema">
      {/* Espresso header band — scoped to Inventory Attendant screens only */}
      <div className="relative bg-espresso px-4 pb-5 pt-6 text-crema">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="font-display text-heading-lg font-medium">Stock on Hand</p>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-label-sm text-crema/70">Central Store</span>
          </div>
          <HelpTip
            title="Stock on Hand"
            triggerClassName="flex h-7 w-7 items-center justify-center rounded-full text-crema/70 transition-colors hover:bg-white/10 hover:text-crema focus-visible:outline-none focus-visible:shadow-focus"
          >
            <p>The Central Store&rsquo;s live inventory — what you have, what it&rsquo;s worth, and whether it&rsquo;s running low.</p>
            {isManager && <p className="mt-2">Tap an item to see its full movement history.</p>}
          </HelpTip>
        </div>
        <div className="flex items-stretch gap-2">
          <div className="min-w-0 flex-1 rounded-md bg-white/10 px-2.5 py-2">
            <p className="truncate text-label-sm text-crema/60">Items</p>
            <p className="truncate text-body-md font-semibold tabular-nums">{items.length}</p>
          </div>
          <div className={cn('min-w-0 flex-1 rounded-md px-2.5 py-2', lowStockCount > 0 ? 'bg-amber/20' : 'bg-white/10')}>
            <p className={cn('truncate text-label-sm', lowStockCount > 0 ? 'text-amber-light' : 'text-crema/60')}>Low Stock</p>
            <p className={cn('truncate text-body-md font-semibold tabular-nums', lowStockCount > 0 && 'text-amber-light')}>{lowStockCount}</p>
          </div>
        </div>
        {/* Amber hairline — the one accent color this band uses, ties to the low-stock/amber system elsewhere */}
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-amber to-transparent" />
      </div>

      <div className="px-4 py-4">
        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items by name…"
            className="h-11 w-full rounded-md border border-stone-200 bg-white pl-9 pr-3 text-body-md text-stone-900 placeholder:text-stone-400 focus:border-espresso focus:outline-none"
          />
        </div>

        {/* Type filter pills — right-edge fade signals there's more to scroll */}
        <div className="relative mb-4 -mx-4">
          <div className="flex gap-2 overflow-x-auto px-4 pb-1">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setTypeFilter(f.value)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-label-md font-medium transition-colors',
                  typeFilter === f.value
                    ? 'border-espresso bg-espresso text-crema'
                    : 'border-stone-200 bg-white text-stone-600',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-crema to-transparent" />
        </div>

        {/* Item list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-md bg-stone-100" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={<Search size={40} />}
            heading={items.length === 0 ? 'No items yet' : 'No items match your search'}
            body={items.length === 0 ? 'The catalog is empty — ask your Store Manager to add items.' : 'Try a different search term or filter.'}
          />
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item, index) => {
              const lowStock = isLowStock(item);
              return (
                <Card
                  key={item.id}
                  onClick={isManager ? () => openMovementHistory(item) : undefined}
                  className={cn(
                    'flex items-center gap-3 border-l-4 p-3',
                    lowStock ? 'border-l-amber' : 'border-l-transparent',
                    isManager && 'cursor-pointer active:bg-stone-50',
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-stone-100 text-label-md font-semibold tabular-nums text-stone-500">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-md font-semibold leading-snug text-stone-900">{item.name}</p>
                    <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-label-sm text-stone-600">
                      {itemTypeLabel[item.type]}
                    </span>
                    {lowStock && (
                      <span className="ml-1.5 inline-block rounded-full bg-amber/15 px-2 py-0.5 text-label-sm font-semibold text-amber">
                        Low Stock
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-heading-sm font-bold tabular-nums text-stone-900">
                      {formatBuyUnitQuantity(item.onHandQty ?? '0', item)}
                    </p>
                    <p className="text-label-sm text-stone-400">{formatBuyUnitCost(item)}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Full-screen movement history — Manager only (§8.1 row 1 mobile:
          "Tap card → full-screen movement history (chronological feed, not
          a table)"). Attendant never sets selectedItem since isManager
          gates openMovementHistory above. */}
      {selectedItem && (
        <div className="fixed inset-0 z-40 flex flex-col bg-crema">
          <div className="bg-espresso px-4 pb-4 pt-6 text-crema">
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="mb-2 flex items-center gap-1 text-label-md text-crema/80"
            >
              <ArrowLeft size={16} /> Stock on Hand
            </button>
            <div className="flex items-center gap-3">
              <IconTile icon={resolveItemIcon(selectedItem.name, selectedItem.type)} />
              <div className="min-w-0">
                <p className="truncate font-display text-heading-md font-medium">{selectedItem.name}</p>
                <p className="text-label-md text-crema/70">{itemTypeLabel[selectedItem.type]} · Movement History</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {isLoadingTransactions ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-md bg-stone-100" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <p className="py-10 text-center text-body-sm text-stone-500">No ledger activity for this item yet.</p>
            ) : (
              <ul className="space-y-2">
                {transactions.map((tx) => {
                  const qty = parseFloat(tx.quantity);
                  const isPositive = qty > 0;
                  return (
                    <li key={tx.id} className="flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-white p-3">
                      <div className="min-w-0">
                        <p className="text-body-sm font-medium text-stone-800">{TRANSACTION_LABELS[tx.type]}</p>
                        <p className="text-label-sm text-stone-400">
                          {new Date(tx.createdAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn('text-label-lg font-semibold tabular-nums', isPositive ? 'text-success' : 'text-danger')}>
                          {isPositive ? '+' : ''}{formatQty(tx.quantity)} {selectedItem.usageUnit}
                        </p>
                        <p className="text-label-sm text-stone-400">Ksh {parseFloat(tx.unitCost).toFixed(2)}/{selectedItem.usageUnit}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
