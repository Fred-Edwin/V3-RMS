import { useCallback, useEffect, useRef, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { listCategories, listItems } from '../services';
import type {
  Category,
  DepartmentTag,
  InventoryItemListRow,
  InventoryItemType,
  ItemCatalogMeta,
} from '../types';

export interface ItemCatalogFilters {
  search?: string;
  type?: InventoryItemType;
  departmentTag?: DepartmentTag;
  categoryId?: string;
  includeRetired: boolean;
  needsSetup: boolean;
}

const DEFAULT_FILTERS: ItemCatalogFilters = { includeRetired: false, needsSetup: false };
const PER_PAGE = 20;

export interface ItemCatalogPagination {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/**
 * Data-loading hook for the Item Catalog screen. Loads items + categories
 * together (the Category filter and the strip both need them). `filters` is
 * read by primitive field, so a caller re-render with the same values never
 * refetches. `page` is owned here so any filter change resets it to 1.
 *
 * Only the latest request may write state: typing in search fires a request
 * per keystroke, and a slow earlier response must not overwrite a later one.
 */
export function useItemCatalog(filters: ItemCatalogFilters = DEFAULT_FILTERS) {
  const [items, setItems] = useState<InventoryItemListRow[]>([]);
  const [meta, setMeta] = useState<ItemCatalogMeta | null>(null);
  const [pagination, setPagination] = useState<ItemCatalogPagination | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const latestRequest = useRef(0);

  const { search, type, departmentTag, categoryId, includeRetired, needsSetup } = filters;

  // Any real filter change invalidates the current page.
  useEffect(() => {
    setPage(1);
  }, [search, type, departmentTag, categoryId, includeRetired, needsSetup]);

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setStatus('loading');
    setError(null);
    try {
      const [itemsResponse, categoryList] = await Promise.all([
        listItems({
          search,
          type,
          departmentTag,
          categoryId,
          includeRetired,
          needsSetup: needsSetup || undefined,
          page,
          perPage: PER_PAGE,
        }),
        listCategories({ includeRetired: true }),
      ]);
      if (requestId !== latestRequest.current) return;
      setItems(itemsResponse.data);
      setMeta(itemsResponse.meta);
      setPagination(itemsResponse.pagination);
      setCategories(categoryList);
      setStatus('ready');
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setError(formatApiErrorMessage(err, 'Could not load the item catalog.'));
      setStatus('error');
    }
  }, [search, type, departmentTag, categoryId, includeRetired, needsSetup, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, meta, pagination, categories, status, error, page, setPage, reload: load };
}
