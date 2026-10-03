'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Search, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { useMobileNavDrawer } from '../../hooks/use-mobile-nav-drawer';
import { useDebouncedValue, useStockList, useStockSummary } from '../../hooks/use-stock';
import { listCategories } from '../../services';
import type { Category } from '../../types';
import type { InventoryItemTypeValue, ListStockQuery, StockSummary } from '../../types/stock';
import { StockTopbar } from '../stock/stock-topbar';
import { LogWasteDrawer } from '../stock/log-waste-drawer';
import { DropdownFilter, FilterChip, MobileStockRow, StockTableHeader, StockTableRow, TypeFilter } from '../stock/stock-table';
import {
  MobileListRowSkeleton,
  SkeletonRows,
  StockEmptyCard,
  StockErrorCard,
  TableRowSkeleton,
} from '../stock/stock-states';
import { formatNumber } from '../stock/stock-format';

/**
 * All items — Milestone Six Session 1, `1B5U-0` (desktop) / `1BRS-0` (mobile).
 * The full Central Store catalog with live on-hand, destination of the hub's
 * "View all items", its KPI cards and the top-bar search. Every filter lives
 * in the URL (`?search=&type=&categoryId=&belowRestock=true&negative=true&page=`)
 * so those links land pre-filtered and Back / reload keep the view.
 */

const PAGE_SIZE = 8;
const ITEM_TYPES: InventoryItemTypeValue[] = ['RAW_INGREDIENT', 'PREPPED', 'STOCKED'];

interface ItemsFilters {
  search: string;
  type?: InventoryItemTypeValue;
  categoryId?: string;
  belowRestock: boolean;
  negative: boolean;
  page: number;
}

function readFilters(params: URLSearchParams): ItemsFilters {
  const type = params.get('type');
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  return {
    search: params.get('search') ?? '',
    type: ITEM_TYPES.includes(type as InventoryItemTypeValue) ? (type as InventoryItemTypeValue) : undefined,
    categoryId: params.get('categoryId') ?? undefined,
    belowRestock: params.get('belowRestock') === 'true',
    negative: params.get('negative') === 'true',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function toSearch(f: ItemsFilters): string {
  const p = new URLSearchParams();
  if (f.search) p.set('search', f.search);
  if (f.type) p.set('type', f.type);
  if (f.categoryId) p.set('categoryId', f.categoryId);
  if (f.belowRestock) p.set('belowRestock', 'true');
  if (f.negative) p.set('negative', 'true');
  if (f.page > 1) p.set('page', String(f.page));
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

/** URL-backed filter state; the search box is local and reaches the URL 250ms after the last keystroke. */
function useItemsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = React.useMemo(() => readFilters(new URLSearchParams(params.toString())), [params]);

  const [searchInput, setSearchInput] = React.useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 250);
  // An outside change to `?search=` (the top-bar search, Back) replaces what's typed.
  const lastUrlSearch = React.useRef(filters.search);
  React.useEffect(() => {
    if (filters.search !== lastUrlSearch.current) {
      lastUrlSearch.current = filters.search;
      setSearchInput(filters.search);
    }
  }, [filters.search]);

  const update = React.useCallback(
    (patch: Partial<ItemsFilters>) => {
      const next = { ...filters, ...patch };
      // Any filter change goes back to page 1; paging itself keeps the filters.
      if (!('page' in patch)) next.page = 1;
      lastUrlSearch.current = next.search;
      router.replace(`${pathname}${toSearch(next)}`, { scroll: false });
    },
    [filters, pathname, router],
  );

  React.useEffect(() => {
    if (debouncedSearch !== filters.search) update({ search: debouncedSearch });
    // Only a settled keystroke pushes to the URL; `update` changes with every filter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const clearAll = React.useCallback(() => {
    setSearchInput('');
    lastUrlSearch.current = '';
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const hasFilters = Boolean(filters.search || filters.type || filters.categoryId || filters.belowRestock || filters.negative);
  return { filters, searchInput, setSearchInput, update, clearAll, hasFilters };
}

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

function emptyCopy(search: string) {
  return search
    ? `Nothing called “${search}” in the Central Store catalog. Try another name, or clear the filters.`
    : 'Nothing in the Central Store catalog matches these filters. Try another combination, or clear the filters.';
}

/* ================================================================ search box */

function ItemsSearchBox({
  value,
  onChange,
  placeholder,
  mobile = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  mobile?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 border bg-wds-surface px-3 transition-[border-color,box-shadow] duration-150 focus-within:border-wds-primary focus-within:shadow-wds-ring',
        mobile ? 'h-[38px] rounded-wds-md border-wds-border-strong' : 'h-[34px] w-[320px] rounded-wds-sm border-wds-border',
      )}
    >
      <Search className={cn('shrink-0 text-wds-text-faint', mobile ? 'size-4' : 'size-3.5')} strokeWidth={2} aria-hidden />
      <input
        ref={inputRef}
        type="search"
        name="stock-item-search"
        autoComplete="off"
        spellCheck={false}
        aria-label="Search items"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            onChange('');
          }
        }}
        className="min-w-0 grow bg-transparent font-wds-sans text-[13px]/4 text-wds-text-ink outline-none placeholder:text-wds-text-faint [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          className="-mr-1 flex size-6 shrink-0 items-center justify-center rounded-wds-sm text-wds-text-faint outline-none transition-colors duration-150 hover:bg-wds-neutral-100 hover:text-wds-text-ink focus-visible:shadow-wds-ring"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/* ================================================================ pagination */

function PagerButton({
  onClick,
  disabled,
  children,
  mobile = false,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  mobile?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1 border px-2.5 font-wds-sans outline-none transition-[background-color,color,transform] duration-150 ease-out focus-visible:shadow-wds-ring enabled:hover:bg-wds-neutral-100 motion-safe:enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:text-wds-text-faint',
        mobile
          ? 'touch-manipulation rounded-wds-md border-wds-border-strong bg-wds-surface py-1.5 text-[12px]/4 text-wds-text-ink'
          : 'rounded-wds-sm border-wds-border py-[5px] text-[13px]/4 text-wds-text-ink',
      )}
    >
      {children}
    </button>
  );
}

/* ================================================================ screen */

export function StockItemsScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const { open: openMobileNav } = useMobileNavDrawer();
  const user = useAuthStore((s) => s.user);
  const { filters, searchInput, setSearchInput, update, clearAll, hasFilters } = useItemsFilters();
  const categories = useTopCategories();
  const { summary: rawSummary } = useStockSummary();
  const summary = rawSummary && 'onHandValue' in rawSummary ? (rawSummary as StockSummary) : null;
  const [wasteOpen, setWasteOpen] = React.useState(false);

  const query: ListStockQuery = {
    search: filters.search || undefined,
    type: filters.type,
    categoryId: filters.categoryId,
    belowRestock: filters.belowRestock || undefined,
    negative: filters.negative || undefined,
    page: filters.page,
    pageSize: PAGE_SIZE,
  };
  const { list, status, refreshing, reload } = useStockList(query);

  // A page past the end (filters narrowed from a deep page, or a stale link) snaps back to the last page.
  React.useEffect(() => {
    if (list && list.pageCount > 0 && filters.page > list.pageCount) update({ page: list.pageCount });
  }, [list, filters.page, update]);

  if (!hydrated) return null;

  const itemCount = summary?.itemCount ?? null;
  const countLabel = itemCount === null ? '' : formatNumber(itemCount);
  const searchPlaceholder = itemCount === null ? 'Search items…' : `Search ${countLabel} items…`;
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));
  const first = list && list.total > 0 ? (list.page - 1) * list.pageSize + 1 : 0;
  const lastShown = list && list.rows.length > 0 ? first + list.rows.length - 1 : 0;
  const pageCount = Math.max(1, list?.pageCount ?? 1);
  const empty = status === 'ready' && list !== null && list.rows.length === 0;

  const body = (mobile: boolean) =>
    status === 'loading' ? (
      <SkeletonRows count={7} label="Loading items">
        {(i) => (mobile ? <MobileListRowSkeleton key={i} /> : <TableRowSkeleton key={i} widths={[96, 64, 48, 56, 90]} />)}
      </SkeletonRows>
    ) : status === 'error' ? (
      <div className="py-8">
        <StockErrorCard title="Couldn't load the item list" description="Check your connection and try again. Your filters are kept." onRetry={reload} />
      </div>
    ) : empty ? (
      <div className="flex justify-center px-4 py-8">
        <StockEmptyCard
          title="No items match these filters"
          description={emptyCopy(filters.search)}
          actionLabel={hasFilters ? 'Clear filters' : undefined}
          onAction={hasFilters ? clearAll : undefined}
        />
      </div>
    ) : (
      <div className={cn('transition-opacity duration-150', refreshing && 'opacity-60')} aria-busy={refreshing}>
        {list?.rows.map((row, i) => (mobile ? <MobileStockRow key={row.itemId} row={row} /> : <StockTableRow key={row.itemId} row={row} last={i === list.rows.length - 1} />))}
      </div>
    );

  const showingText =
    status === 'loading' ? 'Loading items…' : list && list.total > 0 ? `Showing ${first}–${lastShown} of ${formatNumber(list.total)}` : list ? 'Showing 0 items' : '';

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
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [&>*]:shrink-0">
          <div className="flex flex-col gap-2.5 border-b border-wds-border bg-wds-surface px-4 pb-3 pt-3.5">
            <ItemsSearchBox mobile value={searchInput} onChange={setSearchInput} placeholder={searchPlaceholder} />
            <div className="flex gap-2">
              <TypeFilter size="mobile" value={filters.type} onChange={(type) => update({ type })} />
              <FilterChip size="mobile" pressed={filters.belowRestock} onClick={() => update({ belowRestock: !filters.belowRestock })}>
                Below restock
              </FilterChip>
              <FilterChip size="mobile" pressed={filters.negative} onClick={() => update({ negative: !filters.negative })}>
                Negative
              </FilterChip>
            </div>
            {categoryOptions.length > 0 ? (
              <div role="group" aria-label="Category" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[{ value: undefined as string | undefined, label: 'All' }, ...categoryOptions].map((c) => {
                  const selected = filters.categoryId === c.value;
                  return (
                    <button
                      key={c.value ?? 'all'}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => update({ categoryId: c.value })}
                      className={cn(
                        'shrink-0 touch-manipulation whitespace-nowrap rounded-full border px-3.5 py-[7px] font-wds-sans text-[12px]/4 outline-none transition-[background-color,border-color,color] duration-200 ease-out focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]',
                        selected
                          ? 'border-wds-espresso-700 bg-wds-espresso-700 font-medium text-wds-primary-fg'
                          : 'border-wds-border-strong bg-transparent text-wds-text-ink active:bg-wds-neutral-100',
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col px-4 pb-4 pt-1">{body(true)}</div>

          <div className="flex items-center justify-between gap-3 border-t border-wds-border px-4 pb-6 pt-3.5">
            <span className="font-wds-sans text-[12px]/4 text-wds-text-faint" aria-live="polite">
              {showingText}
              {list && list.total > 0 ? ` · Page ${list.page} of ${pageCount}` : ''}
            </span>
            <div className={cn('flex gap-2', !list && 'invisible')}>
              {filters.page > 1 ? (
                <PagerButton mobile disabled={false} onClick={() => update({ page: filters.page - 1 })}>
                  <ChevronRight className="size-3 rotate-180" aria-hidden />
                  Previous
                </PagerButton>
              ) : null}
              <PagerButton mobile disabled={!list || filters.page >= pageCount} onClick={() => update({ page: filters.page + 1 })}>
                Next
                <ChevronRight className="size-3" aria-hidden />
              </PagerButton>
            </div>
          </div>
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

        <div className="flex items-center justify-between gap-4">
          <ItemsSearchBox value={searchInput} onChange={setSearchInput} placeholder={searchPlaceholder} />
          <div className="flex items-center gap-2">
            <TypeFilter size="md" value={filters.type} onChange={(type) => update({ type })} />
            <DropdownFilter
              size="md"
              label="Category"
              allLabel="All categories"
              value={filters.categoryId}
              options={categoryOptions}
              onChange={(categoryId) => update({ categoryId })}
            />
            <FilterChip size="md" pressed={filters.belowRestock} onClick={() => update({ belowRestock: !filters.belowRestock })}>
              Below restock level
            </FilterChip>
            <FilterChip size="md" pressed={filters.negative} onClick={() => update({ negative: !filters.negative })}>
              Negative
            </FilterChip>
          </div>
        </div>

        <section aria-label="Items" className="flex flex-col overflow-hidden rounded-wds-sm border border-wds-border bg-wds-surface">
          <StockTableHeader />
          {body(false)}
        </section>

        <div className="flex items-center justify-between pt-3">
          <span className="font-wds-sans text-[13px]/4 text-wds-text-copy-muted" aria-live="polite">
            {showingText}
            {list && list.total > 0 ? (list.total === 1 ? ' item' : ' items') : ''}
          </span>
          <div className={cn('flex items-center gap-2', !list && 'invisible')}>
            <PagerButton disabled={!list || filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>
              <span aria-hidden>←</span> Previous
            </PagerButton>
            <span className="font-wds-mono text-[13px]/4 text-wds-text-copy-muted">
              Page {list ? list.page : filters.page} of {pageCount}
            </span>
            <PagerButton disabled={!list || filters.page >= pageCount} onClick={() => update({ page: filters.page + 1 })}>
              Next <span aria-hidden>→</span>
            </PagerButton>
          </div>
        </div>
      </main>

      <LogWasteDrawer open={wasteOpen} onOpenChange={setWasteOpen} locationLabel="the Central Store" onLogged={() => void reload()} />
    </div>
  );
}
