'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { Topbar } from '@/components/app/shell/topbar';
import { PermissionDeniedState, LoadingState } from '@/components/app/shell/shell-states';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { useMobileNavDrawer } from '../../hooks/use-mobile-nav-drawer';
import { useCentralStoreLocation } from '../../hooks/use-central-store-location';
import { useItemCatalog, type ItemCatalogFilters } from '../../hooks/use-item-catalog';
import type { DepartmentTag, InventoryItemListRow, InventoryItemType } from '../../types';
import { DEPARTMENT_ORDER, ITEM_TYPE_DOT_CLASS, ITEM_TYPE_LABEL_SHORT } from '../../lib/item-labels';
import { formatHowWeBuy, formatUsedBy } from '../../lib/item-format';
import { CatalogFilters, type FilterOption } from '../catalog/catalog-filters';
import { CatalogKpiStrip, type CatalogKpiCell } from '../catalog/catalog-kpi-strip';
import { CategoryPills } from '../catalog/category-pills';
import { CatalogTable } from '../catalog/catalog-table';
import { ItemAddedBar } from '../catalog/catalog-toast';
import { ItemDrawers, type DrawerRequest } from '../catalog/item-drawers';
import type { CreatedItem } from '../catalog/item-form-view';
import { DEPARTMENT_LABEL } from '../stock/stock-format';
import { MobileListRowSkeleton, SkeletonRows, StockEmptyCard, StockErrorCard, TableRowSkeleton } from '../stock/stock-states';
import { RestockLevelsDrawer } from './restock-levels-screen';

const SEARCH_DEBOUNCE_MS = 250;
const ADDED_BAR_MS = 12_000;

const DEPARTMENT_OPTIONS: FilterOption[] = DEPARTMENT_ORDER.map((tag) => ({ value: tag, label: DEPARTMENT_LABEL[tag] }));

/** A value that follows `value` after it has been still for `delay` ms. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

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
  const role = useAuthStore((s) => s.role);
  const userName = useAuthStore((s) => s.user?.name);
  const isManager = role === 'STORE_MANAGER';
  const canRead = isManager || role === 'STORE_ATTENDANT';

  const [searchInput, setSearchInput] = React.useState('');
  const search = useDebounced(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const [type, setType] = React.useState<InventoryItemType | null>(null);
  const [departmentTag, setDepartmentTag] = React.useState<DepartmentTag | null>(null);
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [showRetired, setShowRetired] = React.useState(false);
  const [needsSetup, setNeedsSetup] = React.useState(false);
  const [lowOrOut, setLowOrOut] = React.useState(false);
  // Newest first, set only right after an item is added so its row is on top; any filter the user changes ends it.
  const [sort, setSort] = React.useState<'newest' | undefined>(undefined);
  const withNaturalOrder =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setSort(undefined);
    };
  const changeSearch = withNaturalOrder(setSearchInput);
  const changeType = withNaturalOrder(setType);
  const changeDepartment = withNaturalOrder(setDepartmentTag);
  const changeCategory = withNaturalOrder(setCategoryId);
  const changeShowRetired = withNaturalOrder(setShowRetired);
  const changeNeedsSetup = withNaturalOrder(setNeedsSetup);
  const changeLowOrOut = withNaturalOrder(setLowOrOut);

  const [request, setRequest] = React.useState<DrawerRequest | null>(null);
  const requestCount = React.useRef(0);
  const openDrawer = React.useCallback((next: DistributiveOmit<DrawerRequest, 'key'>) => {
    requestCount.current += 1;
    setRequest({ ...next, key: requestCount.current } as DrawerRequest);
  }, []);
  const closeDrawer = React.useCallback(() => setRequest(null), []);

  const [restockOpen, setRestockOpen] = React.useState(false);
  const [added, setAdded] = React.useState<CreatedItem | null>(null);
  const { open: openMobileNav } = useMobileNavDrawer();
  const { locationId: centralStoreLocationId } = useCentralStoreLocation(isManager);

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
  const { items, meta, pagination, categories, status, error, page, setPage, reload } = useItemCatalog(filters);

  // On a phone the list scrolls inside <main>: a new filter or page starts from its top.
  const listRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [search, type, departmentTag, categoryId, showRetired, needsSetup, lowOrOut, sort, page]);

  // The "Item added" bar goes by itself; the row's tag stays until the list is reloaded for another reason.
  React.useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(null), ADDED_BAR_MS);
    return () => clearTimeout(timer);
  }, [added]);

  const anyFilter = Boolean(search) || type !== null || departmentTag !== null || categoryId !== null || showRetired || needsSetup || lowOrOut;
  const clearFilters = () => {
    setSearchInput('');
    setType(null);
    setDepartmentTag(null);
    setCategoryId(null);
    setShowRetired(false);
    setNeedsSetup(false);
    setLowOrOut(false);
    setSort(undefined);
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wds-canvas">
        <LoadingState />
      </div>
    );
  }

  if (!canRead) {
    const denied = <PermissionDeniedState description="Item catalog is visible to Store Managers and Store Attendants only." />;
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

  const openItem = isManager ? (row: InventoryItemListRow) => openDrawer({ kind: 'item', itemId: row.id }) : undefined;
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
    setType(null);
    setNeedsSetup(false);
    setLowOrOut(false);
    setSort(undefined);
  };

  const emptyBody = anyFilter ? (
    <StockEmptyCard title="No items match" description="Nothing in the catalog fits these filters. Clear them to see every item." actionLabel="Clear filters" onAction={clearFilters} />
  ) : (
    <StockEmptyCard
      title="No items yet"
      description="Add the first item the store counts. You can add who sells it afterwards."
      actionLabel={isManager ? 'Add an item' : undefined}
      onAction={isManager ? () => openDrawer({ kind: 'add' }) : undefined}
    />
  );
  const emptyCard = <div className="flex justify-center px-4 py-8">{emptyBody}</div>;

  const dataBody = (() => {
    if (status === 'idle' || (status === 'loading' && items.length === 0)) return loadingBody;
    if (status === 'error') {
      return <StockErrorCard title="Couldn’t load the item catalog" description={error ?? 'Check your connection and try again.'} onRetry={() => void reload()} />;
    }
    if (items.length === 0) return emptyCard;
    return <CatalogTable rows={items} showRestockLevel={isManager} onRowClick={openItem} highlightId={added && added.itemType !== 'PREPPED' ? added.itemId : null} />;
  })();

  const footerNote = (() => {
    if (status !== 'ready' && status !== 'loading') return null;
    if (items.length === 0) return null;
    // Search counts against the whole catalog (Paper 1b); a filter counts against what matches it.
    const outOf = search || !anyFilter ? total : (pagination?.total ?? total);
    const count = outOf !== null ? `Showing ${items.length} of ${outOf}` : `Showing ${items.length}`;
    if (search) {
      return `${count} for “${search}”. Search also matches the name or code a supplier uses for an item. Our name stays the same.`;
    }
    return isManager ? `${count}. Restock level is for the Central Store. Departments set their own on their phones.` : `${count}.`;
  })();

  const drawers = isManager ? (
    <>
      <ItemDrawers
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
        onOpenRestockLevels={() => setRestockOpen(true)}
      />
      {centralStoreLocationId ? (
        <RestockLevelsDrawer
          open={restockOpen}
          onOpenChange={setRestockOpen}
          variant={isDesktop ? 'desktop' : 'mobile'}
          locationId={centralStoreLocationId}
          actor={{ role: 'STORE_MANAGER' }}
        />
      ) : null}
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
        <MobileStatusBar />
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
              {pagination && pagination.totalPages > 1 ? (
                <div className="flex items-center justify-between gap-3">
                  <Button variant="secondary" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>
                    Previous
                  </Button>
                  <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button variant="secondary" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)}>
                    Next
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </main>
        {isManager ? (
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
        actions={isManager ? <Button onClick={() => openDrawer({ kind: 'add' })}>New item</Button> : null}
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
          onManageCategories={isManager ? () => openDrawer({ kind: 'categories' }) : undefined}
        />
        <div className="shrink-0 overflow-x-auto">{dataBody}</div>
        {footerNote || (pagination && pagination.totalPages > 1) ? (
          <div className="flex shrink-0 items-center justify-between gap-4">
            <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{footerNote}</p>
            {pagination && pagination.totalPages > 1 ? (
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)}>
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {drawers}
    </div>
  );
}

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

