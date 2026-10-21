'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { isFiltered, nairobiDayOf, paramsFromQuery, queryFromParams } from '../lib/audit-query';
import type { AuditQuery } from '../types/audit-log-types';

/**
 * The log's view lives in the address bar (spec A1): page, rows per page, search, area, event, site, dates, flagged and sort. A change of
 * any filter returns to page 1. `tab` (Company log or Signed documents) is not ours: it is carried through untouched.
 */
export function useAuditQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const today = useMemo(() => nairobiDayOf(), []);
  const raw = search.toString();
  const query = useMemo(() => queryFromParams((key) => new URLSearchParams(raw).get(key), today), [raw, today]);
  const tab = useMemo(() => new URLSearchParams(raw).get('tab'), [raw]);

  const write = useCallback(
    (next: AuditQuery): void => {
      const params = paramsFromQuery(next, today);
      if (tab) params.set('tab', tab);
      const text = params.toString();
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    },
    [router, pathname, today, tab]
  );

  /** Changes filters and goes back to page 1. */
  const change = useCallback((patch: Partial<AuditQuery>): void => write({ ...query, ...patch, page: 1 }), [query, write]);
  const goToPage = useCallback((page: number): void => write({ ...query, page }), [query, write]);
  const clear = useCallback((): void => write({ ...query, q: '', area: '', event: 'all', siteId: '', actorId: '', subjectUserId: '', flagged: false, from: queryFromParams(() => null, today).from, to: today, page: 1 }), [query, today, write]);

  return { query, today, filtered: isFiltered(query, today), key: raw, change, goToPage, clear };
}
