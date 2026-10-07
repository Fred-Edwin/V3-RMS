'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { type HistoryFilters, hasActiveFilters, parseHistoryFilters, writeHistoryFilters } from '../lib/history-filters';

const SEARCH_DELAY_MS = 300;

/**
 * The History filters, kept in the URL so a filtered view can be bookmarked, survives a refresh, and "Clear filters" is simply the
 * clean address. Editing a filter replaces the current history entry (typing must not fill Back with every keystroke); a page
 * change pushes one. Changing any filter returns to page 1. Everything else in the query (`?run=`) is left as it is.
 *
 * `searchText` is what the box shows; it reaches the URL (and so the request) 300 ms after the last keystroke. `update`, `clear`
 * and `setSearchText` keep one identity while the query changes.
 */
export function useHistoryFilters(defaultMine: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const searchRef = React.useRef(search);
  searchRef.current = search;

  const filters = React.useMemo(() => parseHistoryFilters(new URLSearchParams(search.toString()), defaultMine), [search, defaultMine]);

  const go = React.useCallback(
    (params: URLSearchParams, push: boolean) => {
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [router, pathname]
  );

  const update = React.useCallback(
    (patch: Partial<HistoryFilters>) => {
      const base = new URLSearchParams(searchRef.current.toString());
      const current = parseHistoryFilters(base, defaultMine);
      const pageChange = patch.page !== undefined;
      go(writeHistoryFilters(base, { ...current, ...patch, page: patch.page ?? 1 }, defaultMine), pageChange);
    },
    [go, defaultMine]
  );

  const clear = React.useCallback(() => {
    const base = new URLSearchParams(searchRef.current.toString());
    const cleared = new URLSearchParams();
    const run = base.get('run');
    if (run) cleared.set('run', run); // keep an open drawer open
    go(cleared, false);
  }, [go]);

  const [searchText, setSearchText] = React.useState(filters.search);
  const lastWritten = React.useRef(filters.search);
  // The URL changed from outside the box (Clear filters, Back): show what it says. Our own write is skipped, so a letter typed
  // while the URL catches up is not overwritten by the older text.
  React.useEffect(() => {
    if (filters.search === lastWritten.current) return;
    lastWritten.current = filters.search;
    setSearchText(filters.search);
  }, [filters.search]);
  // The box changed: tell the URL once typing pauses.
  React.useEffect(() => {
    if (searchText.trim() === filters.search) return;
    const timer = setTimeout(() => {
      lastWritten.current = searchText.trim();
      update({ search: searchText.trim() });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchText, filters.search, update]);

  return { filters, update, clear, searchText, setSearchText, active: hasActiveFilters(filters, defaultMine) };
}
