import { workforceCan, type AccessSubject } from '../_shared/workforce-access';
import { NotFoundError } from '../../../utils/errors';
import { groupCounts, groupOf, orderForHome, type GroupCount, type MarkedRow } from './needs-you-groups';
import { contextFor, listNeedsYou } from './needs-you-service';
import { attentionRows } from './sources/attention-source';

/**
 * Home's view of Needs you: the same rows as the card plus HR's housekeeping rows (finish hiring, probation, no head), grouped,
 * overdue first, with search, a group filter, a site filter and a pager for the See all list (Paper 1.12). Reads nothing the card
 * does not already read; a person without `needs_you.read` gets 404, like the rest of the feature.
 */

export interface NeedsYouPageQuery {
  q?: string;
  /** A group key from `groupCounts` ("leave", "pay-changes", ...). */
  group?: string;
  siteId?: string;
  page: number;
  pageSize: number;
}

export interface NeedsYouPage {
  rows: MarkedRow[];
  total: number;
  /** All rows the person has, before any filter. */
  all: number;
  overdue: number;
  groups: GroupCount[];
  sites: Array<{ id: string; name: string }>;
  page: number;
  pageSize: number;
  partial: boolean;
}

export const PAGE_SIZES = [10, 25, 50, 100] as const;

/** Every row the person has, overdue first. */
export async function allRowsFor(subject: AccessSubject, now: Date): Promise<{ rows: MarkedRow[]; partial: boolean }> {
  if (!workforceCan(subject, 'needs_you.read')) throw new NotFoundError('Not found');
  const [list, attention] = await Promise.all([listNeedsYou(subject, now), attentionRows(subject, await contextFor(subject, now))]);
  return { rows: orderForHome([...list.rows, ...attention], now), partial: list.partial };
}

const matches = (row: MarkedRow, query: NeedsYouPageQuery): boolean => {
  if (query.group && groupOf(row.kind).key !== query.group) return false;
  if (query.siteId && row.siteId !== query.siteId) return false;
  if (query.q) {
    const needle = query.q.toLowerCase();
    return `${row.text} ${row.siteName ?? ''} ${groupOf(row.kind).label}`.toLowerCase().includes(needle);
  }
  return true;
};

export async function pageNeedsYou(subject: AccessSubject, query: NeedsYouPageQuery, now: Date = new Date()): Promise<NeedsYouPage> {
  const { rows, partial } = await allRowsFor(subject, now);
  const found = rows.filter((r) => matches(r, query));
  const sites = new Map<string, string>();
  for (const r of rows) if (r.siteId && r.siteName) sites.set(r.siteId, r.siteName);
  const start = (query.page - 1) * query.pageSize;
  return {
    rows: found.slice(start, start + query.pageSize),
    total: found.length,
    all: rows.length,
    overdue: rows.filter((r) => r.overdue).length,
    // The chips count what the search and site filter leave, so the numbers match what a click shows.
    groups: groupCounts(rows.filter((r) => matches(r, { ...query, group: undefined }))),
    sites: [...sites.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    page: query.page,
    pageSize: query.pageSize,
    partial,
  };
}
