import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/app/inventory/stock/items',
  useSearchParams: () => new URLSearchParams('search=oat'),
}));

import { DataTable, type TableColumn, type TableCopy } from './data-table';
import { HighlightMatch } from './highlight-match';
import { TablePager } from './table-pager';
import { TableToolbar, type TableFilter } from './table-toolbar';

const h = React.createElement;
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

interface Row {
  id: string;
  name: string;
}
const columns: TableColumn<Row>[] = [{ id: 'name', header: 'Item', cell: (r, { term }) => h(HighlightMatch, { text: r.name, term }) }];
const copy: TableCopy = {
  emptyTitle: 'No items',
  emptyDescription: 'Nothing here.',
  filteredEmptyTitle: 'No items match',
  filteredEmptyDescription: 'Try another search.',
  errorTitle: "Couldn't load items",
};
const never = () => new Promise<never>(() => undefined);

describe('HighlightMatch', () => {
  it('bolds the matching letters', () => {
    expect(html(h(HighlightMatch, { text: 'Oat milk', term: 'oat' }))).toBe('<strong class="font-semibold text-wds-text-ink">Oat</strong> milk');
  });
  it('renders plain text when nothing matches', () => {
    expect(html(h(HighlightMatch, { text: 'Flour', term: 'oat' }))).toBe('Flour');
  });
});

describe('TablePager', () => {
  const pager = (page: number, total: number) =>
    html(h(TablePager, { page, perPage: 50, shown: Math.min(50, total - (page - 1) * 50), total, onPageChange: () => undefined, onPerPageChange: () => undefined }));

  it('shows the range, the page numbers and the current page', () => {
    const out = pager(1, 142);
    expect(out).toContain('Showing 1–50 of 142');
    expect(out).toContain('Rows per page');
    expect(out).toContain('aria-current="page"');
  });
  it('greys and disables the arrow that cannot be used', () => {
    expect(pager(1, 142)).toMatch(/aria-label="Previous page"[^>]*disabled/);
    expect(pager(3, 142)).toMatch(/aria-label="Next page"[^>]*disabled/);
    expect(pager(2, 142)).not.toMatch(/aria-label="Previous page"[^>]*disabled/);
  });
});

describe('TableToolbar', () => {
  const filters: TableFilter[] = [
    { kind: 'chips', key: 'attention', options: [{ value: '', label: 'All' }, { value: 'low', label: 'Low or out' }] },
    { kind: 'dropdown', key: 'categoryId', label: 'Category', options: [{ value: 'c1', label: 'Dairy' }] },
  ];
  const toolbar = (values: Record<string, string>) =>
    html(
      h(TableToolbar, {
        searchText: '',
        onSearchChange: () => undefined,
        searchPlaceholder: 'Find an item',
        searchLabel: 'Search stock items',
        filters,
        values,
        counts: { attention: { '': 142, low: 9 } },
        onFilterChange: () => undefined,
      })
    );

  it('puts counts in the chips and marks the active one', () => {
    const out = toolbar({});
    expect(out).toContain('All 142');
    expect(out).toContain('Low or out 9');
    expect(out).toMatch(/aria-pressed="true"[^>]*>All 142/);
    expect(out).toMatch(/aria-pressed="false"[^>]*>Low or out 9/);
  });
  it('reads "Name · All" on a dropdown with nothing chosen, and the choice once made', () => {
    expect(toolbar({})).toContain('Category · All');
    expect(toolbar({ categoryId: 'c1' })).toContain('Category · Dairy');
  });
});

describe('DataTable states', () => {
  it('shows the loading skeleton on the first load, with the header already in place', () => {
    const out = html(h(DataTable<Row>, { columns, getRowId: (r) => r.id, fetchRows: never, copy, label: 'Stock items' }));
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('Item');
    expect(out).toContain('animate-wds-skeleton');
  });
  it('shows the permission state instead of rows', () => {
    const out = html(h(DataTable<Row>, { columns, getRowId: (r) => r.id, fetchRows: never, copy, label: 'Stock items', permissionDenied: true }));
    expect(out).toContain('This page is not available for your role.');
    expect(out).not.toContain('<table');
  });
  it('puts search in the URL parameter the Stock items screen already uses', () => {
    const out = html(h(DataTable<Row>, { columns, getRowId: (r) => r.id, fetchRows: never, copy, label: 'Stock items' }));
    expect(out).toContain('value="oat"');
  });
});
