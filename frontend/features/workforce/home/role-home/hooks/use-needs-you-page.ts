'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRemote, useWorkforceNudge, type Remote } from '../../../_shared';
import { roleHomeReads } from '../services/role-home-services';
import type { NeedsYouPage, NeedsYouPageQuery } from '../types/role-home-types';

export interface NeedsYouFilters {
  q: string;
  group: string;
  siteId: string;
  page: number;
  pageSize: number;
}

export const INITIAL_FILTERS: NeedsYouFilters = { q: '', group: '', siteId: '', page: 1, pageSize: 10 };

/**
 * The See all list (Paper 1.12): search, a kind chip, a site and a pager, all asked of the server. Typing waits 250 ms; any change of
 * a filter goes back to page 1. The answer keeps the old rows on screen while a new one loads. The same nudges as Home refresh it.
 */
export function useNeedsYouPage() {
  const [filters, setFilters] = useState<NeedsYouFilters>(INITIAL_FILTERS);
  const [settledQ, setSettledQ] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setSettledQ(filters.q), 250);
    return () => window.clearTimeout(id);
  }, [filters.q]);

  const query: NeedsYouPageQuery = useMemo(() => ({ ...filters, q: settledQ }), [filters, settledQ]);
  const key = `${query.q}|${query.group}|${query.siteId}|${query.page}|${query.pageSize}`;
  const remote: Remote<NeedsYouPage> = useRemote(() => roleHomeReads.needsYouPage(query), key);
  const { reload } = remote;
  const again = useCallback(() => reload(), [reload]);
  useWorkforceNudge(['workforce:needs-you'], again);

  const change = useCallback((patch: Partial<NeedsYouFilters>): void => {
    // Any filter change returns to page 1; changing only the page or the page size keeps the others.
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }, []);

  return { filters, change, remote };
}
