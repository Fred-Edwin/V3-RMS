import { DEFAULT_PER_PAGE, normalizePerPage } from '@/components/ui2/data-table/table-query';
import { MONTHS } from '../../_shared/lib/prep-format';
import type { PrepRunStatus, RunsQuery } from '../../_shared/types/prep-contract';

export interface HistoryFilters {
  search: string;
  outputItemId?: string;
  personId?: string;
  status?: PrepRunStatus;
  /** YYYY-MM-DD (Nairobi). */
  from?: string;
  to?: string;
  /** Only the caller's own runs. The Attendant starts with this on; the desktop roles start with it off. */
  mine: boolean;
  page: number;
  /** Rows per page: 25, 50 or 100 (UI_BUILD_RULES §4a). */
  perPage: number;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly PrepRunStatus[] = ['RECORDED', 'CORRECTED', 'CANCELLED'];

/** Reads the History filters from the URL. Anything that does not look right is ignored rather than sent to the server. */
export function parseHistoryFilters(params: URLSearchParams, defaultMine: boolean): HistoryFilters {
  const status = params.get('status');
  const from = params.get('from');
  const to = params.get('to');
  const page = Number(params.get('page'));
  const mineParam = params.get('mine');
  return {
    search: (params.get('q') ?? '').trim(),
    outputItemId: params.get('output') || undefined,
    personId: params.get('person') || undefined,
    status: STATUSES.find((s) => s === status),
    from: from && DATE.test(from) ? from : undefined,
    to: to && DATE.test(to) ? to : undefined,
    mine: mineParam === null ? defaultMine : mineParam === '1',
    page: Number.isInteger(page) && page > 1 ? page : 1,
    perPage: normalizePerPage(Number(params.get('perPage'))),
  };
}

/**
 * Writes filters back onto the URL's query, leaving every other parameter (the open `?run=`) alone. A value equal to its default
 * is left out, so the clean URL `/history` means "the default view" and "Clear filters" is just that URL.
 */
export function writeHistoryFilters(base: URLSearchParams, filters: HistoryFilters, defaultMine: boolean): URLSearchParams {
  const next = new URLSearchParams(base.toString());
  const set = (key: string, value: string | undefined): void => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  set('q', filters.search.trim() || undefined);
  set('output', filters.outputItemId);
  set('person', filters.personId);
  set('status', filters.status);
  set('from', filters.from);
  set('to', filters.to);
  set('mine', filters.mine === defaultMine ? undefined : filters.mine ? '1' : '0');
  set('page', filters.page > 1 ? String(filters.page) : undefined);
  set('perPage', filters.perPage !== DEFAULT_PER_PAGE ? String(filters.perPage) : undefined);
  return next;
}

/** Filters (without paging) in the shape the runs list and the export both take. */
export function toRunsQuery(filters: HistoryFilters): Omit<RunsQuery, 'page' | 'perPage'> {
  return {
    search: filters.search || undefined,
    outputItemId: filters.outputItemId,
    personId: filters.personId,
    status: filters.status,
    mine: filters.mine || undefined,
    from: filters.from,
    to: filters.to,
  };
}

/** True when anything other than the starting view is set (so "Clear filters" has something to clear). */
export function hasActiveFilters(filters: HistoryFilters, defaultMine: boolean): boolean {
  return Boolean(filters.search || filters.outputItemId || filters.personId || filters.status || filters.from || filters.to || filters.mine !== defaultMine);
}

/** The From date is after the To date: nothing can match, and the screen says so instead of showing an empty table. */
export const isBackwardsRange = (filters: Pick<HistoryFilters, 'from' | 'to'>): boolean => Boolean(filters.from && filters.to && filters.from > filters.to);

/** "29 Sep to 12 Oct 2026" / "from 29 Sep 2026" / "to 12 Oct 2026"; empty with neither. */
export function rangeText(filters: Pick<HistoryFilters, 'from' | 'to'>): string {
  const fmt = (iso: string, year: boolean): string => {
    const [y, m, d] = iso.split('-');
    return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ''}${year ? ` ${y}` : ''}`;
  };
  if (filters.from && filters.to) return `${fmt(filters.from, false)} to ${fmt(filters.to, true)}`;
  if (filters.from) return `from ${fmt(filters.from, true)}`;
  if (filters.to) return `to ${fmt(filters.to, true)}`;
  return '';
}
