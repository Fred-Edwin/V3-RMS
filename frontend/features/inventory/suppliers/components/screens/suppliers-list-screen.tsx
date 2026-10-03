'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Topbar } from '@/components/app/shell/topbar';
import { PermissionDeniedState } from '@/components/app/shell/shell-states';
import { useAuthStore } from '@/store/authStore';
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

const SEARCH_DEBOUNCE_MS = 250;
const ROLES_THAT_READ = new Set(['STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR']);

/** A value that follows `value` after it has been still for `delay` ms. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

type StatusFilter = SupplierStatus | 'ANY';
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
  const role = useAuthStore((s) => s.role);
  const canRead = role !== null && ROLES_THAT_READ.has(role);
  const canWrite = role === 'STORE_MANAGER';

  const [searchInput, setSearchInput] = React.useState('');
  const search = useDebounced(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const [status, setStatus] = React.useState<StatusFilter>('ACTIVE');
  const [type, setType] = React.useState<SupplierType | null>(null);
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [unfinished, setUnfinished] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const filters = React.useMemo(
    () => ({
      search: search || undefined,
      status: status === 'ANY' ? undefined : status,
      type: type ?? undefined,
      categoryId: categoryId ?? undefined,
      profileNotFinished: unfinished || undefined,
      page,
    }),
    [search, status, type, categoryId, unfinished, page]
  );
  const { rows, pagination, summary, status: loadStatus, error, reload } = useSuppliersList(filters, canRead);
  const { categories } = useCategoryOptions(canRead);

  // Any change of filter starts again from the first page.
  const change = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };
  const changeSearch = change(setSearchInput);
  const changeStatus = change(setStatus);
  const changeType = change(setType);
  const changeCategory = change(setCategoryId);
  const changeUnfinished = change(setUnfinished);

  const anyFilter = Boolean(search) || type !== null || categoryId !== null || unfinished || status !== 'ACTIVE';
  const clearFilters = () => {
    setSearchInput('');
    setStatus('ACTIVE');
    setType(null);
    setCategoryId(null);
    setUnfinished(false);
    setPage(1);
  };

  if (!canRead) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Central Store', screen: 'Suppliers' }} hideSearch className="shrink-0" />
        <div className="flex flex-1 items-center justify-center">
          <PermissionDeniedState description="Suppliers are visible to the Store Manager, the Accountant and Directors only." />
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
          onSelect: () => {
            changeStatus('ACTIVE');
            changeUnfinished(false);
          },
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

  const footer = (() => {
    if (rows.length === 0 || !pagination) return null;
    const shown = rows.length;
    if (anyFilter) return `Showing ${shown} of ${pagination.total} suppliers that match.`;
    return `Showing ${shown} of ${pagination.total} active suppliers. On hold and archived suppliers show when the Status filter includes them.`;
  })();

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
        <div className="shrink-0 overflow-x-auto">{dataBody}</div>
        {footer || (pagination && pagination.totalPages > 1) ? (
          <div className="flex shrink-0 items-center justify-between gap-4">
            <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{footer}</p>
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
