import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
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
const PER_PAGE = 20;

export interface ItemCatalogPagination {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/**
 * Data-loading hook for the Item Catalog screen. Loads items + categories
 * together since the toolbar's category filter and the KPI strip both need
 * both lists. `filters` is intentionally a plain object recreated by the
 * caller only when a filter actually changes (see the screen component) —
 * this effect depends on its primitive fields, not the object identity, so
 * a caller re-render with the same filter values never triggers a refetch.
 *
 * `page` is owned by this hook (not passed in `filters`) so that changing
 * any other filter always resets it back to 1 — see the effect below.
 */
export function useItemCatalog(filters: ItemCatalogFilters = DEFAULT_FILTERS) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [meta, setMeta] = useState<ItemCatalogMeta | null>(null);
  const [pagination, setPagination] = useState<ItemCatalogPagination | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { search, type, departmentTag, categoryId, includeRetired } = filters;

  // Any real filter change invalidates the current page — go back to page 1
  // rather than requesting a page that may no longer exist for the new filter set.
  useEffect(() => {
    setPage(1);
  }, [search, type, departmentTag, categoryId, includeRetired]);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const [itemsResponse, categoryList] = await Promise.all([
        listItems({ search, type, departmentTag, categoryId, includeRetired, page, perPage: PER_PAGE }),
        listCategories({ includeRetired: true }),
      ]);
      setItems(itemsResponse.data);
      setMeta(itemsResponse.meta);
      setPagination(itemsResponse.pagination);
      setCategories(categoryList);
      setStatus('ready');
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load the item catalog.'));
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, type, departmentTag, categoryId, includeRetired, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, meta, pagination, categories, status, error, page, setPage, reload: load };
}
