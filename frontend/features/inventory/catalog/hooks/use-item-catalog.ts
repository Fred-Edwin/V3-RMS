import { useCallback, useEffect, useRef, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { listCategories, listItems } from '../../services';
import type {
  Category,
  DepartmentTag,
  InventoryItemListRow,
  InventoryItemType,
  ItemCatalogMeta,
} from '../../types';

export interface ItemCatalogFilters {
  search?: string;
  type?: InventoryItemType;
  departmentTag?: DepartmentTag;
  categoryId?: string;
  includeRetired: boolean;
  needsSetup: boolean;
  /** Only Central Store items below their restock level (Store Manager). */
  lowOrOut: boolean;
  /** Unset = by name (oldest first under Needs setup). */
  sort?: 'name' | 'newest';
}

/** Which page, and how many rows, the caller (the URL) is showing. */
export interface ItemCatalogPaging {
  page: number;
  perPage: number;
}

const DEFAULT_FILTERS: ItemCatalogFilters = { includeRetired: false, needsSetup: false, lowOrOut: false };
const DEFAULT_PAGING: ItemCatalogPaging = { page: 1, perPage: 50 };

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
 * refetches. `paging` comes from the caller (the URL holds the page and rows per page,
 * and a filter change returns to page 1 there).
 *
 * Only the latest request may write state: a slow earlier response must not
 * overwrite a later one.
 */
export function useItemCatalog(filters: ItemCatalogFilters = DEFAULT_FILTERS, paging: ItemCatalogPaging = DEFAULT_PAGING) {
  const [items, setItems] = useState<InventoryItemListRow[]>([]);
  const [meta, setMeta] = useState<ItemCatalogMeta | null>(null);
  const [pagination, setPagination] = useState<ItemCatalogPagination | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);

  const { search, type, departmentTag, categoryId, includeRetired, needsSetup, lowOrOut, sort } = filters;
  const { page, perPage } = paging;

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
          lowOrOut: lowOrOut || undefined,
          sort,
          page,
          perPage,
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
  }, [search, type, departmentTag, categoryId, includeRetired, needsSetup, lowOrOut, sort, page, perPage]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, meta, pagination, categories, status, error, reload: load };
}
