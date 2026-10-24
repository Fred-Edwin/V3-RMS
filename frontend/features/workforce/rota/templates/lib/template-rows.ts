import type { TableQuery } from '@/components/ui2/data-table/table-query';

import { nairobiToday, dayOfMonth, monthName } from '../../_shared/lib/rota-dates';
import type { TemplateView } from '../../_shared/types/rota-types';

/** What the Shift templates table shows for a search and a chip: pure, so the counts and the paging are tested. */

const matches = (t: TemplateView, view: string | undefined): boolean => {
  if (view === 'retired') return !t.isActive;
  if (!t.isActive) return false;
  if (view === 'company') return t.organizationId === null;
  if (view === 'site') return t.organizationId !== null;
  return true;
};

export function templateRows(all: readonly TemplateView[], query: TableQuery): { rows: TemplateView[]; total: number } {
  const term = query.search.toLowerCase();
  const found = all
    .filter((t) => matches(t, query.filters.view) && (term === '' || t.name.toLowerCase().includes(term)))
    // Active shifts first, then the retired ones, each by name.
    .sort((a, b) => Number(!a.isActive) - Number(!b.isActive) || a.name.localeCompare(b.name));
  const start = (query.page - 1) * query.perPage;
  return { rows: found.slice(start, start + query.perPage), total: found.length };
}

/** The chip counts: All and Company-wide and "this site only" count active shifts; "Show retired" counts the retired ones, the same number as the Retired box. */
export function templateCounts(all: readonly TemplateView[]): Record<string, Record<string, number>> {
  const active = all.filter((t) => t.isActive);
  return {
    view: {
      '': active.length,
      company: active.filter((t) => t.organizationId === null).length,
      site: active.filter((t) => t.organizationId !== null).length,
      retired: all.length - active.length,
    },
  };
}

/** "Retired 2 Aug". */
export const retiredWords = (iso: string | null): string => {
  if (!iso) return 'Retired';
  const day = nairobiToday(new Date(iso));
  return `Retired ${dayOfMonth(day)} ${monthName(day).slice(0, 3)}`;
};

/** Shifts a Branch Manager may edit: their own site's. Company-wide ones need the company-wide reach. */
export const mayEdit = (t: TemplateView, canWrite: boolean, writesAllSites: boolean): boolean => canWrite && (t.organizationId !== null || writesAllSites);
