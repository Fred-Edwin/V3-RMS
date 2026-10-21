'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useRemote } from '../../../_shared';
import { isFiltered, nairobiDayOf, paramsFromQuery, parseSelected, queryFromParams, selectedKey } from '../lib/documents-query';
import { documentReads } from '../services/documents-services';
import type { DocumentPanelData, DocumentsPage, DocumentsQuery } from '../types/documents-types';

/**
 * The Signed documents index. The view (search, type, dates, sort, page, rows per page) and the chosen document are in the address bar,
 * next to `tab=documents`, so a link reopens the same list with the same document chosen. A change of filter returns to page 1.
 */
export function useDocuments() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const today = useMemo(() => nairobiDayOf(), []);
  const raw = search.toString();
  const query = useMemo(() => queryFromParams((k) => new URLSearchParams(raw).get(k), today, null), [raw, today]);
  const selected = useMemo(() => parseSelected(new URLSearchParams(raw).get('doc')), [raw]);

  const write = useCallback(
    (next: DocumentsQuery, doc: { number: string; version: number } | null): void => {
      const p = paramsFromQuery(next, today);
      p.set('tab', 'documents');
      if (doc) p.set('doc', selectedKey(doc.number, doc.version));
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [router, pathname, today]
  );
  const change = useCallback((patch: Partial<DocumentsQuery>): void => write({ ...query, ...patch, page: 1 }, selected), [query, selected, write]);
  const goToPage = useCallback((page: number): void => write({ ...query, page }, selected), [query, selected, write]);
  const select = useCallback((doc: { number: string; version: number } | null): void => write(query, doc), [query, write]);
  const clear = useCallback((): void => write({ ...query, q: '', type: '', siteId: '', from: queryFromParams(() => null, today, null).from, to: today, page: 1 }, selected), [query, selected, today, write]);

  const list = useRemote<DocumentsPage>(() => documentReads.list(query), `documents:${raw}`);
  const panel = useRemote<DocumentPanelData | null>(() => (selected ? documentReads.panel(selected.number, selected.version) : Promise.resolve(null)), `document:${selected ? selectedKey(selected.number, selected.version) : 'none'}`, selected !== null);

  return { query, today, selected, list, panel, filtered: isFiltered(query, today), change, goToPage, select, clear };
}
