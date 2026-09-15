'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { InventoryDesktopShell } from '../inventory-shell';
import { ItemCatalogList, ItemCatalogTable, ItemCatalogToolbar, type ItemCatalogRow, type ItemType } from '../item-catalog-table';
import { KpiRow, KpiStrip, type KpiCellData } from '../kpi-strip';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '../shell-states';
import { CategoryManagerDrawer } from './category-manager-screen';
import { ItemFormDrawer } from './item-form-screen';
import { RestockLevelsDrawer } from './restock-levels-screen';
import { useCentralStoreLocation } from '../../hooks/use-central-store-location';
import { useItemCatalog, type ItemCatalogFilters } from '../../hooks/use-item-catalog';
import type { DepartmentTag, InventoryItem, InventoryItemType } from '../../types';

const DEPARTMENT_LABEL: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

const TYPE_TO_ROW_TYPE: Record<InventoryItemType, ItemType> = {
  RAW_INGREDIENT: 'raw',
  STOCKED: 'stocked',
  PREPPED: 'prepped',
};

function formatUnits(item: InventoryItem): string {
  if (!item.conversionFactor) return `${item.usageUnit} · no conversion`;
  return `${item.buyUnit} → ${item.usageUnit} · ÷${item.conversionFactor}`;
}

function formatPack(item: InventoryItem): string {
  if (!item.packSize) return '—';
  return `${item.packSize} ${item.usageUnit}`;
}

function formatDepartmentScope(item: InventoryItem): string {
  if (item.retiredAt) return `Retired ${new Date(item.retiredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · history kept`;
  if (item.type === 'RAW_INGREDIENT') return 'Central Store only';
  if (item.departmentTags.length === 0) return 'Central Store only';
  return `Central Store · ${item.departmentTags.map((t) => DEPARTMENT_LABEL[t]).join(', ')}`;
}

function toRow(item: InventoryItem): ItemCatalogRow {
  return {
    id: item.id,
    name: item.name,
    type: TYPE_TO_ROW_TYPE[item.type],
    category: item.category?.name ?? '—',
    units: formatUnits(item),
    pack: formatPack(item),
    departmentScope: formatDepartmentScope(item),
    retired: Boolean(item.retiredAt),
  };
}

/**
 * Item Catalog — screen 1. Reference: `SFQ-0` (desktop) / `TLT-0` (mobile).
 * Assembles KPI Strip + toolbar (real filter wiring) + table/list + the
 * Item Form drawer, plus the universal loading/empty/error/permission states.
 */
export function ItemCatalogScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const role = useAuthStore((s) => s.role);
  const [search, setSearch] = React.useState('');
  const [type, setType] = React.useState<InventoryItemType | null>(null);
  const [departmentTag, setDepartmentTag] = React.useState<DepartmentTag | null>(null);
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [showRetired, setShowRetired] = React.useState(false);
  const [drawerItemId, setDrawerItemId] = React.useState<string | null | undefined>(undefined);
  const [restockDrawerOpen, setRestockDrawerOpen] = React.useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = React.useState(false);

  const filters: ItemCatalogFilters = React.useMemo(
    () => ({
      search: search || undefined,
      type: type ?? undefined,
      departmentTag: departmentTag ?? undefined,
      categoryId: categoryId ?? undefined,
      includeRetired: showRetired,
    }),
    [search, type, departmentTag, categoryId, showRetired]
  );

  const { items, meta, categories, status, error, reload } = useItemCatalog(filters);
  const { locationId: centralStoreLocationId } = useCentralStoreLocation();

  const canRead = role === 'STORE_MANAGER' || role === 'STORE_ATTENDANT';
  const canWrite = role === 'STORE_MANAGER';

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wds-canvas">
        <LoadingState />
      </div>
    );
  }

  if (!canRead) {
    const denied = (
      <PermissionDeniedState description="Item catalog is visible to Store Managers and Store Attendants only." />
    );
    return isDesktop ? (
      <InventoryDesktopShell activeKey="catalog" breadcrumb={{ section: 'Central Store', screen: 'Catalog' }}>
        <div className="flex flex-1 items-center justify-center">{denied}</div>
      </InventoryDesktopShell>
    ) : (
      <div className="flex min-h-screen flex-col items-center justify-center bg-wds-canvas p-4">{denied}</div>
    );
  }

  const kpiCells: KpiCellData[] = meta
    ? [
        { key: 'items', label: 'Items tracked', value: String(meta.itemsTracked), detail: `across ${meta.typesRepresented} types` },
        { key: 'categories', label: 'Categories', value: String(meta.categoryCount), detail: `${meta.retiredCategoryCount} retired` },
        {
          key: 'departments',
          label: 'Departments',
          value: String(meta.departmentCount),
          detail: 'Kitchen, Pastry, Barista, Service, Housekeeping',
        },
        { key: 'suppliers', label: 'Suppliers', value: String(meta.supplierCount), detail: 'on file' },
      ]
    : [];

  const rows = items.map(toRow);
  const categoryOptions = categories.filter((c) => !c.retiredAt).map((c) => ({ value: c.id, label: c.name }));
  const departmentOptions = (Object.keys(DEPARTMENT_LABEL) as DepartmentTag[]).map((tag) => ({
    value: tag,
    label: DEPARTMENT_LABEL[tag],
  }));

  const body = (() => {
    if (status === 'loading' || status === 'idle') {
      return (
        <div className="flex flex-1 items-center justify-center">
          <LoadingState />
        </div>
      );
    }
    if (status === 'error') {
      return (
        <div className="flex flex-1 items-center justify-center">
          <ErrorState
            title="Couldn't load the item catalog"
            description={error ?? 'Check your connection and try again.'}
            onRetry={reload}
          />
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            title="Nothing here yet"
            description="No items match these filters. Try clearing a filter or add a new item."
          />
        </div>
      );
    }
    return isDesktop ? (
      <div className="flex flex-1 flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
        <ItemCatalogToolbar
          itemCount={meta?.itemsTracked ?? rows.length}
          onManageCategories={() => setCategoryDrawerOpen(true)}
          typeFilter={type}
          onTypeFilterChange={(v) => setType(v as InventoryItemType | null)}
          departmentOptions={departmentOptions}
          departmentFilter={departmentTag}
          onDepartmentFilterChange={(v) => setDepartmentTag(v as DepartmentTag | null)}
          categoryOptions={categoryOptions}
          categoryFilter={categoryId}
          onCategoryFilterChange={setCategoryId}
          showRetired={showRetired}
          onShowRetiredChange={setShowRetired}
        />
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <ItemCatalogTable
            rows={rows}
            onRowClick={canWrite ? (row) => setDrawerItemId(row.id) : undefined}
            className="min-w-[860px]"
          />
        </div>
      </div>
    ) : (
      <ItemCatalogList rows={rows} onRowClick={canWrite ? (row) => setDrawerItemId(row.id) : undefined} />
    );
  })();

  if (!isDesktop) {
    return (
      <div className="flex min-h-screen flex-col bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader
          title="Item catalog"
          subtitle={`${meta?.itemsTracked ?? 0} items across the Central Store`}
          userInitials="JM"
        />
        <div className="flex flex-1 flex-col gap-4 p-4">
          {meta ? (
            <KpiRow
              cells={[
                { key: 'items', label: 'Items', value: String(meta.itemsTracked) },
                { key: 'categories', label: 'Categories', value: String(meta.categoryCount) },
                { key: 'suppliers', label: 'Suppliers', value: String(meta.supplierCount) },
              ]}
            />
          ) : null}
          {body}
        </div>
        {canWrite ? (
          <div className="sticky bottom-0 flex gap-2 border-t border-wds-border bg-wds-surface p-4">
            <Button variant="secondary" className="flex-1" onClick={() => setCategoryDrawerOpen(true)}>
              Categories
            </Button>
            <Button className="flex-1" onClick={() => setDrawerItemId(null)}>
              New item
            </Button>
          </div>
        ) : null}
        <ItemFormDrawer
          itemId={drawerItemId === undefined ? null : drawerItemId}
          open={drawerItemId !== undefined}
          onOpenChange={(open) => setDrawerItemId(open ? drawerItemId ?? null : undefined)}
          onSaved={reload}
          variant="mobile"
        />
        <CategoryManagerDrawer open={categoryDrawerOpen} onOpenChange={setCategoryDrawerOpen} variant="mobile" />
      </div>
    );
  }

  return (
    <InventoryDesktopShell
      activeKey="catalog"
      breadcrumb={{ section: 'Central Store', screen: 'Catalog' }}
      searchProps={{ placeholder: 'Search items', value: search, onChange: (e) => setSearch(e.target.value) }}
      actions={
        canWrite ? (
          <>
            <Button
              variant="secondary"
              onClick={() => setRestockDrawerOpen(true)}
              disabled={!centralStoreLocationId}
            >
              Restock levels
            </Button>
            <Button onClick={() => setDrawerItemId(null)}>New item</Button>
          </>
        ) : null
      }
    >
      <div className="flex flex-1 flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">Item catalog</h1>
          <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            Every item Wendo tracks — raw ingredients, prepped items, stocked items. Retiring keeps history; nothing
            is hard-deleted.
          </p>
        </div>
        {kpiCells.length > 0 ? <KpiStrip cells={kpiCells} /> : null}
        {body}
      </div>
      <ItemFormDrawer
        itemId={drawerItemId === undefined ? null : drawerItemId}
        open={drawerItemId !== undefined}
        onOpenChange={(open) => setDrawerItemId(open ? drawerItemId ?? null : undefined)}
        onSaved={reload}
        variant="desktop"
      />
      {centralStoreLocationId ? (
        <RestockLevelsDrawer
          open={restockDrawerOpen}
          onOpenChange={setRestockDrawerOpen}
          variant="desktop"
          locationId={centralStoreLocationId}
          actor={{ role: 'STORE_MANAGER' }}
        />
      ) : null}
      <CategoryManagerDrawer open={categoryDrawerOpen} onOpenChange={setCategoryDrawerOpen} variant="desktop" />
    </InventoryDesktopShell>
  );
}
