'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { applyPatch, parseTableQuery, type QueryPatch, type QueryShape, type TableQuery, writeTableQuery } from './table-query';

/** How long typing must pause before the box reaches the URL (and so the request). One request per pause, never per keystroke. */
export const SEARCH_DEBOUNCE_MS = 250;

/**
 * The table's state, kept in the URL: refresh, Back and a pasted link land on the same view (§4a item 4).
 * A page change pushes a history entry; search, filter and page-size edits replace the current one, so typing never fills Back.
 * Anything else in the query string (`?run=`, `?item=`) is left as it is. `setPage`, `patch`, `clear` and `setSearchText`
 * keep one identity while the URL changes, so they are safe in effect dependencies.
 */
export function useTableUrlState(shape: QueryShape) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const paramsRef = React.useRef(params);
  paramsRef.current = params;

  // The shape is read through a ref: a feature passing `filterKeys` inline must not change the callbacks' identity.
  const shapeRef = React.useRef(shape);
  shapeRef.current = shape;
  const shapeKey = `${shape.filterKeys.join(',')}|${shape.searchParam ?? ''}|${shape.paged === false ? 'u' : 'p'}`;

  const query = React.useMemo(
    () => parseTableQuery(new URLSearchParams(params.toString()), shapeRef.current),
    // shapeKey stands for the shape's content; the shape object itself is rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, shapeKey]
  );

  const go = React.useCallback(
    (next: URLSearchParams, push: boolean) => {
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [router, pathname]
  );

  const patch = React.useCallback(
    (change: QueryPatch) => {
      const base = new URLSearchParams(paramsRef.current.toString());
      const current = parseTableQuery(base, shapeRef.current);
      const next = applyPatch(current, change);
      go(writeTableQuery(base, next, shapeRef.current), change.page !== undefined);
    },
    [go]
  );

  const setPage = React.useCallback((page: number) => patch({ page }), [patch]);

  /** Back to the unfiltered, first page. Keeps unrelated parameters (an open drawer stays open). */
  const clear = React.useCallback(() => {
    const base = new URLSearchParams(paramsRef.current.toString());
    const current = parseTableQuery(base, shapeRef.current);
    const cleared: TableQuery = { ...current, page: 1, search: '', filters: {} };
    go(writeTableQuery(base, cleared, shapeRef.current), false);
  }, [go]);

  const [searchText, setSearchText] = React.useState(query.search);
  const lastWritten = React.useRef(query.search);
  // The URL changed from outside the box (Clear filters, Back): show what it says. Our own write is skipped, so a letter typed
  // while the URL catches up is not overwritten by older text.
  React.useEffect(() => {
    if (query.search === lastWritten.current) return;
    lastWritten.current = query.search;
    setSearchText(query.search);
  }, [query.search]);
  // The box changed: tell the URL once typing pauses.
  React.useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed === query.search) return;
    const timer = setTimeout(() => {
      lastWritten.current = trimmed;
      patch({ search: trimmed });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText, query.search, patch]);

  return { query, patch, setPage, clear, searchText, setSearchText };
}
