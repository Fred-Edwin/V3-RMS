'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { DataTable, type TableColumn, type TableCopy, type TableResult } from '@/components/ui2/data-table/data-table';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';
import { cn } from '@/lib/cn';
import { useMobileNavDrawer } from '../../../_shared/hooks/use-mobile-nav-drawer';
import { useStockSummary } from '../../hooks/use-stock';
import { listStock } from '../../services/stock-api-service';
import { listCategories } from '../../../services';
import type { Category } from '../../../types';
import type { InventoryItemTypeValue, StockRow, StockSummary } from '../../types/stock';
import { StockTopbar } from '../stock-topbar';
import { LogWasteDrawer } from '../../../waste/components/log-waste-drawer';
import { LEDGER_HREF, MobileStockRow } from '../stock-table';
import { formatKes, formatNumber, formatQty, ITEM_TYPE_DOT_CLASS, ITEM_TYPE_LABEL } from '../../../_shared/components/stock-format';

/**
 * All items — Milestone Six Session 1, `1B5U-0` (desktop) / `1BRS-0` (mobile), on the shared table (UI_BUILD_RULES §4a:
 * search and filters first, type-ahead, numbered pager with rows per page, state in the URL). The columns, the row spec and
 * the links are the approved ones; only the toolbar and footer changed. Every filter lives in the URL
 * (`?search=&type=&categoryId=&belowRestock=true&negative=true&page=&perPage=`), so the hub's links land pre-filtered.
 */

const ITEM_TYPES: InventoryItemTypeValue[] = ['RAW_INGREDIENT', 'PREPPED', 'STOCKED'];
const TYPE_OPTIONS = [
  { value: 'STOCKED', label: 'Stocked' },
  { value: 'PREPPED', label: 'Prepped' },
  { value: 'RAW_INGREDIENT', label: 'Raw ingredient' },
];

const COPY: TableCopy = {
  emptyTitle: 'No items yet',
  emptyDescription: 'Items added in the Catalog show up here with what is on hand.',
  filteredEmptyTitle: 'No items match these filters',
  filteredEmptyDescription: 'Try another name, or clear the filters.',
  errorTitle: "Couldn't load the item list",
  errorDescription: 'Check your connection and try again. Your filters are kept.',
};

function useTopCategories(): Category[] {
  const [categories, setCategories] = React.useState<Category[]>([]);
  React.useEffect(() => {
    let live = true;
    listCategories()
      .then((rows) => {
        if (live) setCategories(rows.filter((c) => !c.retiredAt && c.itemCount > 0));
      })
      .catch(() => {
        // The category filter is optional chrome — the list still works without it.
      });
    return () => {
      live = false;
    };
  }, []);
  return categories;
}

function typeOf(value: string | undefined): InventoryItemTypeValue | undefined {
  return ITEM_TYPES.includes(value as InventoryItemTypeValue) ? (value as InventoryItemTypeValue) : undefined;
}

export function StockItemsScreen() {
  const router = useRouter();
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const { open: openMobileNav } = useMobileNavDrawer();
  const user = useAuthStore((s) => s.user);
  const categories = useTopCategories();
  const { summary: rawSummary } = useStockSummary();
  const summary = rawSummary && 'onHandValue' in rawSummary ? (rawSummary as StockSummary) : null;
  const [wasteOpen, setWasteOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const filters = React.useMemo<TableFilter[]>(
    () => [
      {
        kind: 'toggles',
        group: 'status',
        toggles: [
          { key: 'belowRestock', label: 'Low or out' },
          { key: 'negative', label: 'Negative' },
        ],
      },
      { kind: 'dropdown', key: 'categoryId', label: 'Category', options: categories.map((c) => ({ value: c.id, label: c.name })) },
      { kind: 'dropdown', key: 'type', label: 'Type', options: TYPE_OPTIONS },
    ],
    [categories]
  );

  const counts = React.useMemo(
    () =>
      summary
        ? { status: { '': summary.itemCount }, belowRestock: { true: summary.lowCount }, negative: { true: summary.negativeCount } }
        : undefined,
    [summary]
  );

  const fetchRows = React.useCallback(
    async (q: { page: number; perPage: number; search: string; filters: Record<string, string> }): Promise<TableResult<StockRow>> => {
      const list = await listStock({
        search: q.search || undefined,
        type: typeOf(q.filters.type),
        categoryId: q.filters.categoryId,
        belowRestock: q.filters.belowRestock === 'true' || undefined,
        negative: q.filters.negative === 'true' || undefined,
        page: q.page,
        pageSize: q.perPage,
      });
      return { rows: list.rows, total: list.total };
    },
    []
  );

  const columns = React.useMemo<TableColumn<StockRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Item',
        className: 'max-w-0 truncate',
        cell: (row, { term }) => (
          <Link
            href={LEDGER_HREF(row.itemId)}
            onClick={(e) => e.stopPropagation()}
            className="rounded-wds-sm font-wds-sans text-wds-body-sm font-medium text-wds-text-ink outline-none focus-visible:shadow-wds-ring"
          >
            <HighlightMatch text={row.name} term={term} />
          </Link>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        width: '130px',
        cell: (row) => (
          <span className="flex items-center gap-1.5">
            <span className={cn('size-1.5 shrink-0 rounded-full', ITEM_TYPE_DOT_CLASS[row.type])} aria-hidden />
            <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{ITEM_TYPE_LABEL[row.type]}</span>
          </span>
        ),
      },
      {
        id: 'onHand',
        header: 'On hand',
        width: '110px',
        align: 'right',
        cell: (row) => (
          <span className={cn('font-wds-mono text-wds-body-sm', row.isNegative ? 'font-medium text-wds-error-fg' : row.isLow ? 'font-medium text-wds-warning-fg' : 'text-wds-text-ink')}>
            {formatQty(row.onHand, row.usageUnit)}
          </span>
        ),
      },
      {
        id: 'restock',
        header: 'Restock level',
        width: '110px',
        align: 'right',
        cell: (row) => <span className="font-wds-mono text-wds-body-sm text-wds-text-copy-muted">{row.restockLevel ? formatNumber(row.restockLevel) : '—'}</span>,
      },
      {
        id: 'cost',
        header: 'Cost',
        width: '100px',
        align: 'right',
        cell: (row) => <span className="font-wds-mono text-wds-body-sm text-wds-text-copy-muted">{formatNumber(row.currentCost)}</span>,
      },
      {
        id: 'value',
        header: 'Value',
        width: '120px',
        align: 'right',
        cell: (row) => (
          <span className={cn('font-wds-mono text-wds-body-sm', row.isNegative ? 'font-medium text-wds-error-fg' : 'text-wds-text-ink')}>{formatKes(row.value)}</span>
        ),
      },
    ],
    []
  );

  if (!hydrated) return null;

  const itemCount = summary?.itemCount ?? null;
  const countLabel = itemCount === null ? '' : formatNumber(itemCount);
  const searchPlaceholder = itemCount === null ? 'Search items…' : `Search ${countLabel} items…`;

  if (!isDesktop) {
    const initials = user?.name ? user.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') : '—';
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader
          title="All items"
          subtitle={itemCount === null ? 'Full catalog, derived live' : `Full catalog, derived live — ${countLabel} items`}
          userInitials={initials}
          onMenuClick={openMobileNav}
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-4 [&>*]:shrink-0">
          <DataTable<StockRow>
            label="Items"
            layout="cards"
            columns={columns}
            getRowId={(r) => r.itemId}
            fetchRows={fetchRows}
            filters={filters}
            counts={counts}
            copy={COPY}
            searchPlaceholder={searchPlaceholder}
            refreshToken={refreshToken}
            renderCard={(row) => (
              <div className="px-4">
                <MobileStockRow row={row} />
              </div>
            )}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <StockTopbar screen="Stock & counts" onLogWaste={() => setWasteOpen(true)} />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7 [&>*]:shrink-0">
        <div className="flex flex-col gap-1">
          <Link
            href="/app/inventory/stock"
            className="group/back self-start rounded-wds-sm font-wds-sans text-[13px]/4 text-wds-text-copy-muted outline-none transition-colors duration-150 hover:text-wds-text-ink focus-visible:shadow-wds-ring"
          >
            <span className="inline-block transition-transform duration-150 ease-out group-hover/back:-translate-x-0.5">←</span> Back to Stock &amp; counts
          </Link>
          <h1 className="font-wds-sans text-[24px]/[30px] font-semibold tracking-[-0.01em] text-wds-text-ink">All items</h1>
          <p className="font-wds-sans text-[14px]/[18px] text-wds-text-copy-muted">
            Full Central Store catalog, derived live from the ledger{itemCount === null ? '' : ` — ${countLabel} items`}
          </p>
        </div>

        <DataTable<StockRow>
          label="Items"
          columns={columns}
          getRowId={(r) => r.itemId}
          fetchRows={fetchRows}
          filters={filters}
          counts={counts}
          copy={COPY}
          searchPlaceholder="Find an item"
          onRowActivate={(row) => router.push(LEDGER_HREF(row.itemId))}
          refreshToken={refreshToken}
        />
      </main>

      <LogWasteDrawer open={wasteOpen} onOpenChange={setWasteOpen} locationLabel="the Central Store" onLogged={() => setRefreshToken((n) => n + 1)} />
    </div>
  );
}
