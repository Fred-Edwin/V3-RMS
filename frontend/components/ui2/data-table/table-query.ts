/**
 * The shared table's query model: what the URL holds and how it changes (UI_BUILD_RULES §4a).
 * Pure functions only, so the rules are unit-tested without a browser.
 *
 * Owner-unconfirmed proposals (8 Oct 2026), kept here so they are one-line changes:
 * the row-count choices and the default, and holding the state in the URL.
 */

/** "Rows per page" choices. §4a proposal: 25, 50, 100. */
export const PER_PAGE_OPTIONS = [25, 50, 100] as const;
/** §4a proposal: 50. */
export const DEFAULT_PER_PAGE = 50;
/** `perPage` value meaning "the whole list" (the drag-to-reorder exception, §4a item 5). */
export const UNPAGED = 0;

export const PAGE_PARAM = 'page';
export const PER_PAGE_PARAM = 'perPage';
/** Matches the name the Stock items and Prep history screens already use in their URLs. */
export const DEFAULT_SEARCH_PARAM = 'search';

export interface TableQuery {
  page: number;
  perPage: number;
  search: string;
  /** Filter key to chosen value. A filter at "All" is absent, never an empty string. */
  filters: Record<string, string>;
}

export interface QueryShape {
  /** Every filter key the table understands (chips and dropdowns). Anything else in the URL is left alone. */
  filterKeys: readonly string[];
  searchParam?: string;
  /** False for the reorder exception: no `page` / `perPage` in the URL, the whole list is one page. */
  paged?: boolean;
}

function positiveInt(raw: string | null, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** An unknown or hand-edited `perPage` falls back to the default rather than asking the server for it. */
export function normalizePerPage(n: number): number {
  return (PER_PAGE_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_PER_PAGE;
}

export function parseTableQuery(params: URLSearchParams, shape: QueryShape): TableQuery {
  const paged = shape.paged !== false;
  const filters: Record<string, string> = {};
  for (const key of shape.filterKeys) {
    const v = params.get(key);
    if (v) filters[key] = v;
  }
  return {
    page: paged ? positiveInt(params.get(PAGE_PARAM), 1) : 1,
    perPage: paged ? normalizePerPage(positiveInt(params.get(PER_PAGE_PARAM), DEFAULT_PER_PAGE)) : UNPAGED,
    search: (params.get(shape.searchParam ?? DEFAULT_SEARCH_PARAM) ?? '').trim(),
    filters,
  };
}

/** Writes the query onto a copy of `base`. Defaults are omitted so the clean address is the unfiltered list. */
export function writeTableQuery(base: URLSearchParams, query: TableQuery, shape: QueryShape): URLSearchParams {
  const next = new URLSearchParams(base.toString());
  const searchParam = shape.searchParam ?? DEFAULT_SEARCH_PARAM;
  next.delete(PAGE_PARAM);
  next.delete(PER_PAGE_PARAM);
  next.delete(searchParam);
  for (const key of shape.filterKeys) next.delete(key);
  if (shape.paged !== false) {
    if (query.page > 1) next.set(PAGE_PARAM, String(query.page));
    if (query.perPage !== DEFAULT_PER_PAGE) next.set(PER_PAGE_PARAM, String(query.perPage));
  }
  if (query.search) next.set(searchParam, query.search);
  for (const key of shape.filterKeys) {
    const v = query.filters[key];
    if (v) next.set(key, v);
  }
  return next;
}

export interface QueryPatch {
  page?: number;
  perPage?: number;
  search?: string;
  /** A value of `''` or `undefined` clears that filter. */
  filters?: Record<string, string | undefined>;
}

/** Applies a change. Changing the search, a filter or the page size returns to page 1 (§4a item 4); only a page change keeps its page. */
export function applyPatch(current: TableQuery, patch: QueryPatch): TableQuery {
  const filters = { ...current.filters };
  for (const [key, value] of Object.entries(patch.filters ?? {})) {
    if (value) filters[key] = value;
    else delete filters[key];
  }
  return {
    page: patch.page ?? 1,
    perPage: patch.perPage ?? current.perPage,
    search: patch.search ?? current.search,
    filters,
  };
}

export function hasActiveNarrowing(q: TableQuery): boolean {
  return q.search !== '' || Object.keys(q.filters).length > 0;
}

export function totalPages(total: number, perPage: number): number {
  if (perPage <= 0) return 1;
  return Math.max(1, Math.ceil(total / perPage));
}

/** "Showing 1–50 of 142". An empty list reads "Showing 0 of 0". */
export function showingText(page: number, perPage: number, shown: number, total: number): string {
  if (total === 0 || shown === 0) return 'Showing 0 of 0';
  if (perPage <= 0) return `Showing 1–${shown} of ${total}`;
  const from = (page - 1) * perPage + 1;
  return `Showing ${from}–${from + shown - 1} of ${total}`;
}

/** The numbered pager: ‹ 1 2 3 … 12 ›. Always the first and last page, the current page and one either side. */
export type PageItem = number | 'gap';
export function pageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = new Set<number>([1, 2, total - 1, total, current - 1, current, current + 1]);
  if (current <= 3) [1, 2, 3, 4].forEach((n) => wanted.add(n));
  if (current >= total - 2) [total - 3, total - 2, total - 1, total].forEach((n) => wanted.add(n));
  const sorted = Array.from(wanted).filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: PageItem[] = [];
  sorted.forEach((n, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && n - prev > 1) out.push('gap');
    out.push(n);
  });
  return out;
}

export interface Segment {
  text: string;
  match: boolean;
}

/** Splits `text` around every case-insensitive occurrence of `term`, so the matching letters can be bold. */
export function splitMatches(text: string, term: string): Segment[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return [{ text, match: false }];
  const hay = text.toLowerCase();
  const out: Segment[] = [];
  let at = 0;
  for (;;) {
    const hit = hay.indexOf(needle, at);
    if (hit === -1) break;
    if (hit > at) out.push({ text: text.slice(at, hit), match: false });
    out.push({ text: text.slice(hit, hit + needle.length), match: true });
    at = hit + needle.length;
  }
  if (at < text.length) out.push({ text: text.slice(at), match: false });
  return out.length ? out : [{ text, match: false }];
}

/** The line that says what matched: `3 matches for "oat"`. */
export function matchSummary(total: number, term: string): string {
  return `${total} ${total === 1 ? 'match' : 'matches'} for “${term}”`;
}
