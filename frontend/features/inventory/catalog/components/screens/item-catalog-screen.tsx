'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { TablePager } from '@/components/ui2/data-table/table-pager';
import { useTableUrlState } from '@/components/ui2/data-table/use-table-url-state';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { Topbar } from '@/components/app/shell/topbar';
import { PermissionDeniedState, LoadingState } from '@/components/app/shell/shell-states';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { useMobileNavDrawer } from '../../../_shared/hooks/use-mobile-nav-drawer';
import { useItemCatalog, type ItemCatalogFilters } from '../../hooks/use-item-catalog';
import type { DepartmentTag, InventoryItemListRow, InventoryItemType } from '../../../types';
import { DEPARTMENT_ORDER, ITEM_TYPE_DOT_CLASS, ITEM_TYPE_LABEL_SHORT } from '../../lib/item-labels';
import { formatHowWeBuy, formatUsedBy } from '../../../_shared/lib/item-format';
import { CatalogFilters, type FilterOption } from '../catalog-filters';
import { CatalogKpiStrip, type CatalogKpiCell } from '../catalog-kpi-strip';
import { CategoryPills } from '../category-pills';
import { CatalogTable } from '../catalog-table';
import { ItemAddedBar } from '../catalog-toast';
import { ItemDrawers, type DrawerRequest } from '../item-drawers';
import type { CreatedItem } from '../item-form-view';
import { DEPARTMENT_LABEL } from '../../../_shared/components/stock-format';
import { MobileListRowSkeleton, SkeletonRows, StockEmptyCard, StockErrorCard, TableRowSkeleton } from '../../../_shared/components/stock-states';

const ADDED_BAR_MS = 12_000;

const DEPARTMENT_OPTIONS: FilterOption[] = DEPARTMENT_ORDER.map((tag) => ({ value: tag, label: DEPARTMENT_LABEL[tag] }));

/** The URL parameters this screen owns, next to `search`, `page` and `perPage`. */
const CATALOG_FILTER_KEYS = ['type', 'department', 'category', 'retired', 'needsSetup', 'lowOrOut'] as const;

function MobileItemRow({ row, onClick }: { row: InventoryItemListRow; onClick?: () => void }) {
  const retired = row.retiredAt !== null;
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      className={cn('flex flex-col gap-1 border-b border-wds-border p-3 last:border-b-0', retired && 'opacity-55', onClick && 'cursor-pointer')}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-wds-sans text-wds-body font-medium text-wds-text-ink">{row.name}</span>
        <span className="shrink-0 font-wds-mono text-wds-caption text-wds-text-copy-muted">{formatHowWeBuy(row)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span aria-hidden className={cn('size-1.5 shrink-0 rounded-wds-full', ITEM_TYPE_DOT_CLASS[row.type])} />
        <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
          {ITEM_TYPE_LABEL_SHORT[row.type]} · {row.category?.name ?? 'No category'} · {formatUsedBy(row)}
        </span>
      </div>
    </div>
  );
}

/**
 * Item catalog — Paper "Chapter 1 · Add an item", step 01 (and 1b search
 * match). The strip's cells are one-tap filters; search also matches the name
 * or code a supplier uses. Add, edit, retire and the item page are drawers
 * (`ItemDrawers`). The phone layout is the previous one, kept working until
 * the phone session redraws it.
 */
export function ItemCatalogScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const userName = useAuthStore((s) => s.user?.name);
  // What this person may do comes from the Central Store permissions table (server), not from their role name.
  const { can, ready } = usePermissions();
  const canRead = can('catalog.read');
  /** Opens the item panel: the roles that may read item history (read-only unless they can also write). */
  const canOpenItem = can('catalog.read_history');
  const canWrite = can('catalog.write');
  const seesRestock = can('restock.read');

  // Search, filters, page and rows per page live in the URL (§4a), so refresh, Back and a pasted link keep the view.
  const { query, patch, setPage, clear, searchText: searchInput, setSearchText: setSearchInput } = useTableUrlState({ filterKeys: CATALOG_FILTER_KEYS });
  const search = query.search;
  const type = (query.filters.type as InventoryItemType | undefined) ?? null;
  const departmentTag = (query.filters.department as DepartmentTag | undefined) ?? null;
  const categoryId = query.filters.category ?? null;
  const showRetired = query.filters.retired === '1';
  const needsSetup = query.filters.needsSetup === '1';
  const lowOrOut = query.filters.lowOrOut === '1';
  // Newest first, set only right after an item is added so its row is on top; any filter the user changes ends it.
  const [sort, setSort] = React.useState<'newest' | undefined>(undefined);
  const setFilter = (key: string, value: string | null) => {
    patch({ filters: { [key]: value ?? '' } });
    setSort(undefined);
  };
  const changeSearch = (value: string) => {
    setSearchInput(value);
    setSort(undefined);
  };
  const changeType = (value: InventoryItemType | null) => setFilter('type', value);
  const changeDepartment = (value: DepartmentTag | null) => setFilter('department', value);
  const changeCategory = (value: string | null) => setFilter('category', value);
  const changeShowRetired = (value: boolean) => setFilter('retired', value ? '1' : null);
  const changeNeedsSetup = (value: boolean) => setFilter('needsSetup', value ? '1' : null);
  const changeLowOrOut = (value: boolean) => setFilter('lowOrOut', value ? '1' : null);

  const [request, setRequest] = React.useState<DrawerRequest | null>(null);
  const requestCount = React.useRef(0);
  const openDrawer = React.useCallback((next: DistributiveOmit<DrawerRequest, 'key'>) => {
    requestCount.current += 1;
    setRequest({ ...next, key: requestCount.current } as DrawerRequest);
  }, []);
  const closeDrawer = React.useCallback(() => setRequest(null), []);

  // A link from a supplier's Catalog tab ("History") lands here with ?item=<id>: open that item's page once.
  React.useEffect(() => {
    if (!canOpenItem) return;
    const itemId = new URLSearchParams(window.location.search).get('item');
    if (itemId) openDrawer({ kind: 'item', itemId });
  }, [canOpenItem, openDrawer]);

  const [added, setAdded] = React.useState<CreatedItem | null>(null);
  const { open: openMobileNav } = useMobileNavDrawer();
  const router = useRouter();

  const filters: ItemCatalogFilters = React.useMemo(
    () => ({
      search: search || undefined,
      type: type ?? undefined,
      departmentTag: departmentTag ?? undefined,
      categoryId: categoryId ?? undefined,
      includeRetired: showRetired,
      needsSetup,
      lowOrOut,
      sort,
    }),
    [search, type, departmentTag, categoryId, showRetired, needsSetup, lowOrOut, sort]
  );
  const paging = React.useMemo(() => ({ page: query.page, perPage: query.perPage }), [query.page, query.perPage]);
  const { items, meta, pagination, categories, status, error, reload } = useItemCatalog(filters, paging);
  const page = query.page;

  // On a phone the list scrolls inside <main>: a new filter or page starts from its top.
  const listRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [search, type, departmentTag, categoryId, showRetired, needsSetup, lowOrOut, sort, page, query.perPage]);

  // The "Item added" bar goes by itself; the row's tag stays until the list is reloaded for another reason.
  React.useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(null), ADDED_BAR_MS);
    return () => clearTimeout(timer);
  }, [added]);

  const anyFilter = Boolean(search) || type !== null || departmentTag !== null || categoryId !== null || showRetired || needsSetup || lowOrOut;
  const clearFilters = () => {
    clear();
    setSort(undefined);
  };

  if (!hydrated || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wds-canvas">
        <LoadingState />
      </div>
    );
  }

  if (!canRead) {
    const denied = <PermissionDeniedState description="The item catalog is not available for your role." />;
    return isDesktop ? (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Central Store', screen: 'Catalog' }} className="shrink-0" />
        <div className="flex flex-1 items-center justify-center">{denied}</div>
      </div>
    ) : (
      <div className="flex min-h-screen flex-col items-center justify-center bg-wds-canvas p-4">{denied}</div>
    );
  }

  const categoryOptions: FilterOption[] = categories.filter((c) => !c.retiredAt).map((c) => ({ value: c.id, label: c.name }));

  const cells: CatalogKpiCell[] = [];
  if (meta) {
    cells.push({
      key: 'tracked',
      label: 'Items tracked',
      value: String(meta.itemsTracked),
      sub: `across ${meta.typesRepresented} ${meta.typesRepresented === 1 ? 'type' : 'types'}`,
      onSelect: clearFilters,
    });
    cells.push({
      key: 'needs-setup',
      label: 'Needs setup',
      value: String(meta.needsSetup),
      sub: 'pack or units not set yet',
      attention: meta.needsSetup > 0,
      onSelect: () => changeNeedsSetup(!needsSetup),
      active: needsSetup,
    });
    if (meta.lowOrOut !== null) {
      cells.push({
        key: 'low-or-out',
        label: 'Low or out',
        value: String(meta.lowOrOut),
        sub: 'below their restock level',
        attention: meta.lowOrOut > 0,
        onSelect: () => changeLowOrOut(!lowOrOut),
        active: lowOrOut,
      });
    }
    cells.push({
      key: 'added',
      label: 'Added this week',
      value: String(meta.addedThisWeek),
      sub: meta.addedByAttendant > 0 ? `${meta.addedByAttendant} added by an attendant` : 'in the last 7 days',
    });
  }

  const openItem = canOpenItem ? (row: InventoryItemListRow) => openDrawer({ kind: 'item', itemId: row.id }) : undefined;
  const total = meta?.itemsTracked ?? null;

  const loadingBody = (
    <div className="border border-wds-border bg-white" aria-hidden={false}>
      <div className="flex h-[34px] items-center border-b border-wds-text-ink px-4 font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink">ITEM</div>
      <SkeletonRows count={8} label="Loading items">
        {(i) => (
          <TableRowSkeleton key={i} className="h-[46px]" nameWidth={160 + ((i * 37) % 90)} widths={[96, 90, 110, 56, 100]} />
        )}
      </SkeletonRows>
    </div>
  );

  const showAll = () => {
    patch({ filters: { type: '', needsSetup: '', lowOrOut: '' } });
    setSort(undefined);
  };

  const emptyBody = anyFilter ? (
    <StockEmptyCard title="No items match" description="Nothing in the catalog fits these filters. Clear them to see every item." actionLabel="Clear filters" onAction={clearFilters} />
  ) : (
    <StockEmptyCard
      title="No items yet"
      description="Add the first item the store counts. You can add who sells it afterwards."
      actionLabel={canWrite ? 'Add an item' : undefined}
      onAction={canWrite ? () => openDrawer({ kind: 'add' }) : undefined}
    />
  );
  const emptyCard = <div className="flex justify-center px-4 py-8">{emptyBody}</div>;

  const dataBody = (() => {
    if (status === 'idle' || (status === 'loading' && items.length === 0)) return loadingBody;
    if (status === 'error') {
      return <StockErrorCard title="Couldn’t load the item catalog" description={error ?? 'Check your connection and try again.'} onRetry={() => void reload()} />;
    }
    if (items.length === 0) return emptyCard;
    return <CatalogTable rows={items} showRestockLevel={seesRestock} onRowClick={openItem} highlightId={added && added.itemType !== 'PREPPED' ? added.itemId : null} />;
  })();

  // The count and pages are the shared pager's; this is the note that explains what the list shows.
  const footerNote = (() => {
    if (status !== 'ready' && status !== 'loading') return null;
    if (items.length === 0) return null;
    if (search) return 'Search also matches the name or code a supplier uses for an item. Our name stays the same.';
    return seesRestock ? 'Restock level is for the Central Store. Departments set their own on their phones.' : null;
  })();
  const pager =
    pagination && pagination.total > 0 ? (
      <TablePager
        page={query.page}
        perPage={query.perPage}
        shown={items.length}
        total={pagination.total}
        onPageChange={setPage}
        onPerPageChange={(perPage) => patch({ perPage })}
      />
    ) : null;

  const drawers = canOpenItem ? (
    <>
      <ItemDrawers
        readOnly={!canWrite}
        request={request}
        onClose={closeDrawer}
        onItemCreated={(created) => {
          // The list is by name, so the new row may be pages away: show newest first so it is on top, tinted.
          clearFilters();
          setSort('newest');
          setAdded(created);
          void reload();
        }}
        onItemChanged={() => void reload()}
        onCategoriesChanged={() => void reload()}
        totalItems={total}
        onOpenRestockLevels={() => router.push('/app/inventory/stock/restock-levels')}
      />
      {added ? (
        <ItemAddedBar
          message={`${added.itemName} added.${userName ? ` Logged for ${userName}.` : ''}`}
          // A Prepped item is made in Prep, not bought: nobody sells it, so the next step is just to open it.
          actionLabel={added.itemType === 'PREPPED' ? 'Open item →' : 'Add who sells it →'}
          onAction={() => {
            openDrawer(added.itemType === 'PREPPED' ? { kind: 'item', itemId: added.itemId } : { kind: 'addSeller', itemId: added.itemId });
            setAdded(null);
          }}
          onDismiss={() => setAdded(null)}
        />
      ) : null}
    </>
  ) : null;

  if (!isDesktop) {
    const pills = categories.filter((c) => !c.retiredAt).map((c) => ({ id: c.id, name: c.name, count: c.itemCount }));
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <MobileHubHeader title="Item catalog" subtitle={`${meta?.itemsTracked ?? 0} items across the Central Store`} userInitials="JM" onMenuClick={openMobileNav} />
        {/* Search and category pills stay put; only the list below scrolls. */}
        <div className="flex shrink-0 flex-col gap-3 border-b border-wds-border bg-wds-surface px-4 py-3">
          <input
            type="search"
            name="search"
            aria-label="Search items"
            placeholder="Search items"
            value={searchInput}
            onChange={(e) => changeSearch(e.target.value)}
            className="h-11 w-full rounded-wds-md border border-wds-border-strong bg-wds-surface px-3 font-wds-sans text-wds-body text-wds-text-ink placeholder:text-wds-text-muted focus-visible:outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring"
          />
          {pills.length > 0 ? <CategoryPills categories={pills} selectedId={categoryId} onSelect={changeCategory} /> : null}
        </div>
        <main ref={listRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4 [&>*]:shrink-0">
          {status === 'error' ? (
            <StockErrorCard title="Couldn’t load the item catalog" description={error ?? 'Check your connection and try again.'} onRetry={() => void reload()} />
          ) : status === 'idle' || (status === 'loading' && items.length === 0) ? (
            <SkeletonRows count={6} label="Loading items">
              {(i) => <MobileListRowSkeleton key={i} />}
            </SkeletonRows>
          ) : items.length === 0 ? (
            emptyCard
          ) : (
            <>
              <div className="flex flex-col rounded-wds-md border border-wds-border bg-wds-surface">
                {items.map((row) => (
                  <MobileItemRow key={row.id} row={row} onClick={openItem ? () => openItem(row) : undefined} />
                ))}
              </div>
              {pager ? <div className="border border-wds-border">{pager}</div> : null}
            </>
          )}
        </main>
        {canWrite ? (
          <div className="flex shrink-0 gap-2 border-t border-wds-border bg-wds-surface p-4">
            <Button variant="secondary" className="flex-1" onClick={() => openDrawer({ kind: 'categories' })}>
              Categories
            </Button>
            <Button className="flex-1" onClick={() => openDrawer({ kind: 'add' })}>
              New item
            </Button>
          </div>
        ) : null}
        {drawers}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ section: 'Central Store', screen: 'Catalog' }}
        searchProps={{ placeholder: 'Search items', value: searchInput, onChange: (e) => changeSearch(e.target.value), className: 'w-[380px]', 'aria-label': 'Search items' }}
        actions={canWrite ? <Button onClick={() => openDrawer({ kind: 'add' })}>New item</Button> : null}
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex shrink-0 flex-col gap-1.5">
          <h1 className="font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink">Item catalog</h1>
          <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
            Everything Wendo buys, makes and uses. Nothing is deleted: retire an item and its history stays.
          </p>
        </div>
        {cells.length > 0 ? <CatalogKpiStrip cells={cells} className="shrink-0" /> : null}
        <CatalogFilters
          className="shrink-0"
          total={total}
          typeCounts={meta?.typeCounts}
          otherFilterOn={lowOrOut}
          type={type}
          onTypeChange={changeType}
          needsSetup={needsSetup}
          needsSetupCount={meta?.needsSetup ?? null}
          onShowAll={showAll}
          onNeedsSetupChange={changeNeedsSetup}
          categoryOptions={categoryOptions}
          categoryId={categoryId}
          onCategoryChange={changeCategory}
          departmentOptions={DEPARTMENT_OPTIONS}
          departmentTag={departmentTag}
          onDepartmentChange={(tag) => changeDepartment(tag as DepartmentTag | null)}
          showRetired={showRetired}
          onShowRetiredChange={changeShowRetired}
          onManageCategories={canWrite ? () => openDrawer({ kind: 'categories' }) : undefined}
        />
        <div className="shrink-0">
          <div className="overflow-x-auto">{dataBody}</div>
          {pager && items.length > 0 ? <div className="border border-t-0 border-wds-border">{pager}</div> : null}
        </div>
        {footerNote ? <p className="shrink-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{footerNote}</p> : null}
      </div>
      {drawers}
    </div>
  );
}

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

