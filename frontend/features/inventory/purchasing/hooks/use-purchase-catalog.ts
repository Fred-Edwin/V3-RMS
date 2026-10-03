import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { buyUnitPriceFromCost } from '../../catalog/lib/buy-unit-price';
import { getCentralStoreLocation, listCategories, listItems, listRestockLevels } from '../../services';
import type { Category } from '../../types';

export interface PurchaseCatalogRow {
  inventoryItemId: string;
  itemName: string;
  categoryName: string;
  buyUnit: string;
  /** e.g. "12 units" — packSize + usageUnit, matching Paper's "carton · 12 units" sub-line. Null when the item has no pack conversion. */
  packLabel: string | null;
  /** Per USAGE unit — see `buyUnitPriceFromCost`. */
  currentCost: string;
  /** `currentCost` converted to the buy unit, for pre-filling a purchase price. */
  buyUnitPrice: string;
  onHandQty: string | null;
  parLevel: string | null;
  isBelowLevel: boolean;
}

/**
 * Data source for the New Purchase catalog picker (`X9J-0`/`XUT-0`) — joins
 * the item catalog (name, category, buy unit, current cost) with the
 * Central Store's restock levels (on-hand, par) so the picker's "On hand" /
 * "Par" columns are real ledger-derived data, not fabricated fields on
 * `InventoryItem` (which has neither). `centralStoreRestockLevel` on
 * `InventoryItem` is a par-level default only, not on-hand — `onHandQty`
 * only exists on `RestockLevelRow`, per `listRestockLevels`.
 */
export function usePurchaseCatalog() {
  const [items, setItems] = useState<PurchaseCatalogRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const { id: locationId } = await getCentralStoreLocation();
      const [itemList, categoryList, restockRows] = await Promise.all([
        listItems({ includeRetired: false, perPage: 100 }),
        listCategories({ includeRetired: false }),
        listRestockLevels({ locationId }, { role: 'STORE_MANAGER' }),
      ]);
      const restockByItemId = new Map(restockRows.map((row) => [row.inventoryItemId, row]));
      const rows: PurchaseCatalogRow[] = itemList.data.map((item) => {
        const restock = restockByItemId.get(item.id);
        return {
          inventoryItemId: item.id,
          itemName: item.name,
          categoryName: item.category?.name ?? '—',
          buyUnit: item.buyUnit,
          packLabel: item.packSize ? `${item.packSize} ${item.usageUnit}` : null,
          currentCost: item.currentCost,
          buyUnitPrice: buyUnitPriceFromCost(item.currentCost, item.conversionFactor),
          onHandQty: restock?.onHandQty ?? null,
          parLevel: restock?.level ?? item.centralStoreRestockLevel ?? null,
          isBelowLevel: restock?.isBelowLevel ?? false,
        };
      });
      setItems(rows);
      setCategories(categoryList);
      setStatus('ready');
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load the catalog.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, categories, status, error, reload: load };
}

export type StockLevelFilter = 'any' | 'low';

/** Search + category + low-stock filtering shared by desktop table and mobile list. */
export function useFilteredPurchaseCatalog(
  rows: PurchaseCatalogRow[],
  search: string,
  categoryId: string | null,
  categoryName: string | null,
  stockFilter: StockLevelFilter
) {
  return useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (query && !row.itemName.toLowerCase().includes(query)) return false;
      if (categoryId && categoryName && row.categoryName !== categoryName) return false;
      if (stockFilter === 'low' && !row.isBelowLevel) return false;
      return true;
    });
  }, [rows, search, categoryId, categoryName, stockFilter]);
}
