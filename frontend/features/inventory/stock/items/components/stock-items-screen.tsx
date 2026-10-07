'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { DataTable, type TableColumn } from '@/components/ui2/data-table/data-table';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';
import { cn } from '@/lib/cn';
import { ScwStatePanel } from '../../../_shared/components/scw-states';
import { ScwKpiStrip, ScwKpiStripSkeleton } from '../../../_shared/components/scw-kpi-strip';
import { ScwTopbar } from '../../../_shared/components/scw-topbar';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { signedKes, plainQty } from '../../../counting/_shared/lib/count-format';
import { STOCK_STATES_COPY } from '../../_shared/lib/states-copy';
import { stockApi } from '../../_shared/services/stock-api';
import type { ItemStockStatus, StockItemRow, StockItemsList } from '../../_shared/types/stock-contract';

const DOT: Record<ItemStockStatus, { text: string; cls: string; dot: string }> = {
  OK: { text: 'OK', cls: 'text-wds-success-fg', dot: 'bg-wds-success-fg' },
  LOW: { text: 'Low', cls: 'text-wds-warning-fg', dot: 'bg-wds-warning-fg' },
  OUT: { text: 'Out', cls: 'text-wds-warning-fg', dot: 'bg-wds-warning-fg' },
  NEGATIVE: { text: 'Negative', cls: 'text-wds-error-fg', dot: 'bg-wds-error-fg' },
};

const COPY = {
  emptyTitle: 'No items',
  emptyDescription: 'No items are set up yet.',
  filteredEmptyTitle: 'No items match',
  filteredEmptyDescription: STOCK_STATES_COPY.allItems.empty,
  errorTitle: 'Could not load items',
  errorDescription: 'Try again. Nothing was changed.',
  permissionDescription: STOCK_STATES_COPY.allItems.permission,
};

const FILTERS: TableFilter[] = [
  { kind: 'chips', key: 'status', options: [{ value: '', label: 'All' }, { value: 'low', label: 'Low or out' }, { value: 'negative', label: 'Negative' }] },
  { kind: 'dropdown', key: 'categoryId', label: 'Category', options: ['Beverages', 'Coffee', 'Dairy', 'Dry goods', 'Flavourings', 'Meat', 'Packaging', 'Produce', 'Spices'].map((v) => ({ value: v, label: v })) },
  { kind: 'dropdown', key: 'type', label: 'Type', options: ['Stocked', 'Raw ingredient', 'Prepped'].map((v) => ({ value: v, label: v })) },
  { kind: 'dropdown', key: 'departmentTag', label: 'Department', options: [{ value: 'KITCHEN', label: 'Kitchen' }, { value: 'BARISTA', label: 'Barista' }] },
  { kind: 'dropdown', key: 'sectionId', label: 'Section', options: ['Samrat', 'Summer', 'Others', 'Packaging'].map((v, i) => ({ value: ['s-samrat', 's-summer', 's-others', 's-packaging'][i] as string, label: v })) },
];

/**
 * All items (Paper step 27, `224J-0`; `/stock/items`), read only for every desktop role: the strip (two cells are one tap into
 * Low or out / Negative), then the one shared table with search first, filters, chips, numbered pager and rows per page in the URL.
 * A row opens that item's stock card. The wording of the filters is the Catalog's.
 */
export function StockItemsScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { can, ready } = usePermissions();
  const [kpis, setKpis] = React.useState<StockItemsList['kpis'] | null>(null);
  const [counts, setCounts] = React.useState<Record<string, Record<string, number>>>({});
  const status = params.get('status') ?? '';

  const columns = React.useMemo<TableColumn<StockItemRow>[]>(
    () => [
      { id: 'name', header: 'Item', cell: (r, { term }) => <span className="text-wds-text-ink"><HighlightMatch text={r.name} term={term} /></span> },
      { id: 'section', header: 'Section', width: '150px', cell: (r) => <span className="text-wds-text-secondary">{r.sectionName ?? 'No section'}</span> },
      { id: 'onHand', header: 'On hand', width: '120px', align: 'right', cell: (r) => <span className={cn('font-wds-mono', r.status === 'OK' ? 'text-wds-text-ink' : r.status === 'NEGATIVE' ? 'text-wds-error-fg' : 'text-wds-warning-fg')}>{plainQty(r.onHand)} {r.unit}</span> },
      { id: 'level', header: 'Restock level', width: '120px', align: 'right', cell: (r) => <span className="font-wds-mono text-wds-text-secondary">{r.restockLevel ? `${plainQty(r.restockLevel)} ${r.unit}` : '–'}</span> },
      { id: 'value', header: 'Value', width: '120px', align: 'right', cell: (r) => <span className={cn('font-wds-mono', Number(r.valueKes) < 0 ? 'text-wds-error-fg' : 'text-wds-text-ink')}>{signedKes(r.valueKes)}</span> },
      { id: 'counted', header: 'Last counted', width: '130px', className: 'pl-4', cell: (r) => <span className="font-wds-mono text-[12px] text-wds-text-secondary">{r.lastCountedText}</span> },
      { id: 'status', header: 'Status', width: '110px', cell: (r) => <span className={cn('inline-flex items-center gap-1.5 text-[13px]', DOT[r.status].cls)}><span className={cn('size-1.5 rounded-full', DOT[r.status].dot)} aria-hidden />{DOT[r.status].text}</span> },
    ],
    [],
  );

  const setStatus = (value: string): void => {
    const q = new URLSearchParams(params.toString());
    if (value) q.set('status', value);
    else q.delete('status');
    q.delete('page');
    router.replace(`/app/inventory/stock/items?${q}`, { scroll: false });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScwTopbar
        breadcrumb={{ section: 'Central Store', screen: 'All items' }}
        actions={
          <>
            {can('waste.log') ? <Button variant="secondary" asChild><Link href="/app/inventory/stock/waste?drawer=log">Log waste</Link></Button> : null}
            {can('counts.record') ? <Button asChild><Link href="/app/inventory/stock/counts/new">Start count</Link></Button> : null}
          </>
        }
      />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-mobile-title tracking-tight text-wds-text-ink">All items</h1>
          <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">Everything in the Central Store, with what is on hand now. Click a row for its ledger.</p>
        </div>
        {ready && !can('stock.read') ? (
          <ScwStatePanel kind="permission" text={STOCK_STATES_COPY.allItems.permission} />
        ) : (
          <>
            {kpis ? <ScwKpiStrip cells={kpis} activeFilter={status} onFilter={(f) => setStatus(status === f ? '' : f)} /> : <ScwKpiStripSkeleton />}
            <DataTable<StockItemRow>
              label="Stock items"
              columns={columns}
              getRowId={(r) => r.itemId}
              filters={FILTERS}
              copy={COPY}
              counts={counts}
              enabled={ready}
              searchPlaceholder="Find an item"
              onRowActivate={(r) => router.push(`/app/inventory/stock/ledger/${r.itemId}`)}
              rowClassName={(r) => (r.status === 'NEGATIVE' ? 'bg-wds-error-bg' : undefined)}
              fetchRows={async (q, { signal }) => {
                const res = await stockApi.items(
                  { search: q.search || undefined, status: (q.filters.status as 'low' | 'negative' | undefined) ?? 'all', categoryId: q.filters.categoryId, type: q.filters.type, departmentTag: q.filters.departmentTag, sectionId: q.filters.sectionId, page: q.page, pageSize: q.perPage as 25 | 50 | 100 },
                  signal,
                );
                setKpis(res.kpis);
                setCounts({ status: { '': res.chips.all, low: res.chips.low, negative: res.chips.negative } });
                return { rows: res.rows, total: res.page.total };
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}
