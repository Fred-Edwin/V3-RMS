import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/types/api';
import { listCategories, listItems } from '../services';
import type { Category, DepartmentTag, InventoryItem, InventoryItemType, ItemCatalogMeta } from '../types';

export interface ItemCatalogFilters {
  search?: string;
  type?: InventoryItemType;
  departmentTag?: DepartmentTag;
  categoryId?: string;
  includeRetired: boolean;
}

const DEFAULT_FILTERS: ItemCatalogFilters = { includeRetired: false };

/**
 * Data-loading hook for the Item Catalog screen. Loads items + categories
 * together since the toolbar's category filter and the KPI strip both need
 * both lists. `filters` is intentionally a plain object recreated by the
 * caller only when a filter actually changes (see the screen component) —
 * this effect depends on its primitive fields, not the object identity, so
 * a caller re-render with the same filter values never triggers a refetch.
 */
export function useItemCatalog(filters: ItemCatalogFilters = DEFAULT_FILTERS) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [meta, setMeta] = useState<ItemCatalogMeta | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const { search, type, departmentTag, categoryId, includeRetired } = filters;

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const [itemsResponse, categoryList] = await Promise.all([
        listItems({ search, type, departmentTag, categoryId, includeRetired }),
        listCategories({ includeRetired: true }),
      ]);
      setItems(itemsResponse.data);
      setMeta(itemsResponse.meta);
      setCategories(categoryList);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the item catalog.');
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, type, departmentTag, categoryId, includeRetired]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, meta, categories, status, error, reload: load };
}
