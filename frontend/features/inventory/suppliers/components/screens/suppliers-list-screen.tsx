'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { TablePager } from '@/components/ui2/data-table/table-pager';
import { useTableUrlState } from '@/components/ui2/data-table/use-table-url-state';
import { Topbar } from '@/components/app/shell/topbar';
import { LoadingState, PermissionDeniedState } from '@/components/app/shell/shell-states';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { useCategoryOptions } from '../../../catalog/hooks/use-item-form';
import { useSuppliersList } from '../../hooks/use-suppliers-list';
import type { SupplierStatus, SupplierType } from '../../types/supplier';
import { SUPPLIER_TYPE_LABEL, SUPPLIER_TYPE_ORDER, formatAmount } from '../../lib/supplier-logic';
import { DrawerHost } from '../../../catalog/components/drawer-parts';
import { CatalogKpiStrip, type CatalogKpiCell } from '../../../catalog/components/catalog-kpi-strip';
import { StockEmptyCard, StockErrorCard, SkeletonRows, TableRowSkeleton } from '../../../_shared/components/stock-states';
import { SupplierFormView } from '../supplier-form-view';
import { FilterMenu, PageHeading } from '../supplier-ui';
import { SuppliersTable } from '../suppliers-table';

/** The URL parameters this screen owns, next to `search`, `page` and `perPage`. */
const SUPPLIER_FILTER_KEYS = ['status', 'type', 'category', 'unfinished'] as const;

type StatusFilter = SupplierStatus | 'ANY';
const STATUS_TO_URL: Record<StatusFilter, string> = { ACTIVE: '', ON_HOLD: 'on-hold', ARCHIVED: 'archived', ANY: 'any' };
const STATUS_FROM_URL: Record<string, StatusFilter | undefined> = { 'on-hold': 'ON_HOLD', archived: 'ARCHIVED', any: 'ANY' };
const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'ANY', label: 'Active and on hold' },
];

/**
 * Suppliers — Paper "Chapter 4 · Add a supplier", step 14. The four-number strip filters the list (On hold and
 * Profile not finished are one-tap filters); the table shows profile and what we owe on every row; "New supplier"
 * opens the drawer of step 15 and then the new supplier's page (step 16). The Store Manager reads and writes; the
 * Accountant and Directors read. No phone layout yet (none is drawn).
 */
export function SuppliersListScreen() {
  const router = useRouter();
  const { can, ready: permissionsReady } = usePermissions();
  const canRead = can('suppliers.read');
  const canWrite = can('suppliers.write');

  // Search, filters, page and rows per page live in the URL (§4a). The Status filter starts on Active, so Active is the
  // address with no `status`; the other choices are written out.
  const { query, patch, setPage, clear, searchText: searchInput, setSearchText: changeSearch } = useTableUrlState({ filterKeys: SUPPLIER_FILTER_KEYS });
  const search = query.search;
  const status: StatusFilter = STATUS_FROM_URL[query.filters.status ?? ''] ?? 'ACTIVE';
  const type = (query.filters.type as SupplierType | undefined) ?? null;
  const categoryId = query.filters.category ?? null;
  const unfinished = query.filters.unfinished === '1';
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const filters = React.useMemo(
    () => ({
      search: search || undefined,
      status: status === 'ANY' ? undefined : status,
      type: type ?? undefined,
      categoryId: categoryId ?? undefined,
      profileNotFinished: unfinished || undefined,
      page: query.page,
      perPage: query.perPage,
    }),
    [search, status, type, categoryId, unfinished, query.page, query.perPage]
  );
  const { rows, pagination, summary, status: loadStatus, error, reload } = useSuppliersList(filters, canRead);
  const { categories } = useCategoryOptions(canRead);

  const changeStatus = (v: StatusFilter) => patch({ filters: { status: v === 'ACTIVE' ? '' : STATUS_TO_URL[v] } });
  const changeType = (v: SupplierType | null) => patch({ filters: { type: v ?? '' } });
  const changeCategory = (v: string | null) => patch({ filters: { category: v ?? '' } });
  const changeUnfinished = (v: boolean) => patch({ filters: { unfinished: v ? '1' : '' } });

  const anyFilter = Boolean(search) || type !== null || categoryId !== null || unfinished || status !== 'ACTIVE';
  const clearFilters = clear;

  if (!permissionsReady) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Central Store', screen: 'Suppliers' }} hideSearch className="shrink-0" />
        <div className="flex flex-1 items-center justify-center">
          <LoadingState />
        </div>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Central Store', screen: 'Suppliers' }} hideSearch className="shrink-0" />
        <div className="flex flex-1 items-center justify-center">
          <PermissionDeniedState description="Suppliers are not available for your role." />
        </div>
      </div>
    );
  }

  const totalSuppliers = summary ? summary.active + summary.onHold : null;
  const cells: CatalogKpiCell[] = summary
    ? [
        {
          key: 'active',
          label: 'Active',
          value: String(summary.active),
          sub: totalSuppliers !== null ? `of ${totalSuppliers} suppliers` : '',
          // One patch, not two: each URL change starts from the address as it is now.
          onSelect: () => patch({ filters: { status: '', unfinished: '' } }),
        },
        {
          key: 'on-hold',
          label: 'On hold',
          value: String(summary.onHold),
          sub: 'not used for new orders',
          attention: summary.onHold > 0,
          arrow: true,
          onSelect: () => changeStatus(status === 'ON_HOLD' ? 'ACTIVE' : 'ON_HOLD'),
          active: status === 'ON_HOLD',
        },
        {
          key: 'unfinished',
          label: 'Profile not finished',
          value: String(summary.profileNotFinished),
          sub: 'missing contact, bank or KRA PIN',
          attention: summary.profileNotFinished > 0,
          arrow: true,
          onSelect: () => changeUnfinished(!unfinished),
          active: unfinished,
        },
        {
          key: 'owed',
          label: 'Owed · all suppliers',
          value: `KES ${formatAmount(summary.owedAmount)}`,
          sub: summary.suppliersOwed === 1 ? 'owed to 1 supplier' : `owed to ${summary.suppliersOwed} suppliers`,
        },
      ]
    : [];

  const categoryOptions = categories.filter((c) => !c.retiredAt);
  const categoryLabel = categoryOptions.find((c) => c.id === categoryId)?.name ?? 'All';

  const dataBody = (() => {
    if (loadStatus === 'idle' || (loadStatus === 'loading' && rows.length === 0)) {
      return (
        <div className="border border-wds-border bg-white">
          <div className="flex h-[34px] items-center border-b border-wds-text-ink px-4 font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink">CODE</div>
          <SkeletonRows count={6} label="Loading suppliers">
            {(i) => <TableRowSkeleton key={i} className="h-[54px]" nameWidth={150 + ((i * 37) % 80)} widths={[70, 60, 90, 50, 60]} />}
          </SkeletonRows>
        </div>
      );
    }
    if (loadStatus === 'error') {
      return <StockErrorCard title="Couldn’t load suppliers" description={error ?? 'Check your connection and try again.'} onRetry={() => void reload()} />;
    }
    if (rows.length === 0) {
      return (
        <div className="flex justify-center px-4 py-8">
          {anyFilter ? (
            <StockEmptyCard title="No suppliers match" description="Nobody fits these filters. Clear them to see every active supplier." actionLabel="Clear filters" onAction={clearFilters} />
          ) : (
            <StockEmptyCard
              title="No suppliers yet"
              description="Add the first business you buy from. You can finish its profile afterwards."
              actionLabel={canWrite ? 'New supplier' : undefined}
              onAction={canWrite ? () => setDrawerOpen(true) : undefined}
            />
          )}
        </div>
      );
    }
    return <SuppliersTable rows={rows} />;
  })();

  // The count and pages are the shared pager's; this is the note that explains what the list shows.
  const footer = rows.length > 0 && !anyFilter ? 'Active suppliers. On hold and archived suppliers show when the Status filter includes them.' : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ section: 'Central Store', screen: 'Suppliers' }}
        hideSearch
        actions={canWrite ? <Button className="px-3.5" onClick={() => setDrawerOpen(true)}>New supplier</Button> : null}
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-8 py-7">
        <PageHeading title="Suppliers">Who we buy from, what they sell us, how we pay them and what we owe.</PageHeading>
        {cells.length > 0 ? <CatalogKpiStrip cells={cells} className="shrink-0" /> : null}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <input
            type="search"
            name="search"
            aria-label="Search suppliers"
            placeholder="Search name, code or phone"
            autoComplete="off"
            value={searchInput}
            onChange={(e) => changeSearch(e.target.value)}
            className="h-[30px] w-[280px] shrink-0 rounded-wds-sm border border-wds-border-strong bg-white px-3 font-wds-sans text-[13px] leading-4 text-wds-text-ink transition-colors placeholder:text-wds-text-faint focus-visible:border-wds-selected-edge focus-visible:shadow-[0_0_0_1px_var(--wds-selected-edge)] focus-visible:outline-none"
          />
          <FilterMenu<StatusFilter>
            name="Status"
            valueLabel={STATUS_OPTIONS.find((o) => o.value === status)?.label ?? 'Active'}
            options={STATUS_OPTIONS}
            onSelect={(v) => changeStatus(v ?? 'ACTIVE')}
          />
          <FilterMenu<SupplierType>
            name="Type"
            valueLabel={type ? SUPPLIER_TYPE_LABEL[type] : 'All'}
            options={[{ value: null, label: 'All types' }, ...SUPPLIER_TYPE_ORDER.map((t) => ({ value: t, label: SUPPLIER_TYPE_LABEL[t] }))]}
            onSelect={changeType}
          />
          <FilterMenu<string>
            name="Category"
            valueLabel={categoryLabel}
            options={[{ value: null, label: 'All categories' }, ...categoryOptions.map((c) => ({ value: c.id, label: c.name }))]}
            onSelect={changeCategory}
          />
          <span aria-hidden className="h-5 w-px shrink-0 bg-wds-border-strong" />
          <button
            type="button"
            aria-pressed={unfinished}
            onClick={() => changeUnfinished(!unfinished)}
            className={cn(
              'inline-flex h-[30px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-wds-sm border px-3 font-wds-sans text-[13px] font-medium leading-4 transition-[background-color,border-color,transform] duration-150 focus-visible:outline-none focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]',
              unfinished
                ? 'border-wds-warning-fg bg-wds-warning-fg text-white'
                : 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg hover:border-wds-warning-fg'
            )}
          >
            <span aria-hidden className={cn('size-1.5 shrink-0 rounded-[3px]', unfinished ? 'bg-white' : 'bg-wds-warning-fg')} />
            Profile not finished
            {summary ? <span className="font-wds-mono text-[11px] leading-[14px] font-normal">{summary.profileNotFinished}</span> : null}
          </button>
          <span className="grow" />
          {pagination ? <span className="font-wds-mono text-[11px] leading-[14px] tracking-[0.04em] text-wds-text-secondary">{pagination.total} {pagination.total === 1 ? 'SUPPLIER' : 'SUPPLIERS'}</span> : null}
        </div>
        <div className="shrink-0">
          <div className="overflow-x-auto">{dataBody}</div>
          {pagination && pagination.total > 0 && rows.length > 0 ? (
            <div className="border border-t-0 border-wds-border">
              <TablePager
                page={query.page}
                perPage={query.perPage}
                shown={rows.length}
                total={pagination.total}
                onPageChange={setPage}
                onPerPageChange={(perPage) => patch({ perPage })}
              />
            </div>
          ) : null}
        </div>
        {footer ? <p className="shrink-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{footer}</p> : null}
      </div>
      {canWrite ? (
        <DrawerHost open={drawerOpen} onOpenChange={setDrawerOpen} label="New supplier">
          <SupplierFormView
            categories={categories}
            onCancel={() => setDrawerOpen(false)}
            onSaved={(created) => {
              setDrawerOpen(false);
              void reload();
              router.push(`/app/inventory/suppliers/${created.id}`);
            }}
          />
        </DrawerHost>
      ) : null}
    </div>
  );
}
