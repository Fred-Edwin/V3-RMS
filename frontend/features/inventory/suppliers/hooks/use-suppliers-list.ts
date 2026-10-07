import { useCallback, useMemo } from 'react';

import { getSupplierListSummary, listSupplierRows } from '../../services';
import type { SupplierListRow, SupplierListSummary, SupplierStatus, SupplierType } from '../types/supplier';
import { useLoader } from '../../_shared/hooks/use-async';

export interface SuppliersListFilters {
  search?: string;
  status?: SupplierStatus;
  type?: SupplierType;
  categoryId?: string;
  profileNotFinished?: boolean;
  page: number;
  /** Rows per page: 25, 50 or 100 (UI_BUILD_RULES §4a). */
  perPage: number;
}

/** The suppliers list and the four numbers above it. Both reload together after a create. */
export function useSuppliersList(filters: SuppliersListFilters, enabled: boolean) {
  const { search, status, type, categoryId, profileNotFinished, page, perPage } = filters;
  const key = enabled ? JSON.stringify([search, status, type, categoryId, profileNotFinished, page, perPage]) : null;

  const list = useLoader(
    key,
    () => listSupplierRows({ search: search || undefined, status, type, categoryId, profileNotFinished: profileNotFinished || undefined, page, perPage }),
    'Could not load suppliers.'
  );
  const strip = useLoader<SupplierListSummary>(enabled ? 'strip' : null, getSupplierListSummary, 'Could not load the supplier numbers.');

  const { reload: reloadList } = list;
  const { reload: reloadStrip } = strip;
  const reload = useCallback(async () => {
    await Promise.all([reloadList(), reloadStrip()]);
  }, [reloadList, reloadStrip]);

  const rows: SupplierListRow[] = useMemo(() => list.data?.data ?? [], [list.data]);
  return {
    rows,
    pagination: list.data?.pagination ?? null,
    summary: strip.data,
    status: list.status,
    error: list.error,
    reload,
  };
}
