'use client';

import * as React from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Checkbox } from '@/components/ui2/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui2/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import type { Category } from '../types';
import type { PurchaseCatalogRow, StockLevelFilter } from '../hooks/use-purchase-catalog';

/**
 * Purchase Catalog Picker — desktop table (`X9J-0` → `XDD-0`/`XCW-0`) and
 * mobile card list (`XUT-0`). New composite, 04-components.md's Milestone
 * Two "New Purchase redesign" entry. Both breakpoints share one filtering
 * contract; only the outer chrome (table vs. cards, inline filter bar vs.
 * a Filters sheet) differs, since `XUT-0` draws only a "Filters" button with
 * no expanded sheet artboard — the sheet's contents are a judgement call
 * noted in that doc entry.
 */

export interface PurchaseCatalogPickerProps {
  rows: PurchaseCatalogRow[];
  categories: Category[];
  selectedIds: Set<string>;
  onToggle: (row: PurchaseCatalogRow) => void;
  search: string;
  onSearchChange: (value: string) => void;
  categoryId: string | null;
  onCategoryChange: (value: string | null) => void;
  stockFilter: StockLevelFilter;
  onStockFilterChange: (value: StockLevelFilter) => void;
  className?: string;
}

/**
 * On Hand/Par need a short unit word ("carton", per Paper's `X9J-0`), not the
 * full buy-unit spec ("ctn (12x2kg)") already shown once under the item name
 * — repeating the parenthetical in every column is what made the table read
 * as cluttered.
 */
function shortUnit(buyUnit: string): string {
  return buyUnit.replace(/\s*\(.*?\)\s*/g, '').trim() || buyUnit;
}

function StockDot({ tone }: { tone: 'low' | 'ok' }) {
  return (
    <span
      aria-hidden
      className={cn('size-1.5 shrink-0 rounded-full', tone === 'low' ? 'bg-wds-warning-fg' : 'bg-wds-success-fg')}
    />
  );
}

/* ------------------------------------------------------------- Desktop */

function DesktopFilterBar({
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  categories,
  stockFilter,
  onStockFilterChange,
}: Pick<
  PurchaseCatalogPickerProps,
  'search' | 'onSearchChange' | 'categoryId' | 'onCategoryChange' | 'categories' | 'stockFilter' | 'onStockFilterChange'
>) {
  return (
    <div className="flex shrink-0 items-center gap-wds-2">
      <div className="flex h-8 w-60 shrink-0 items-center gap-wds-1.5 rounded-wds-sm border border-wds-border-strong px-wds-2.5">
        <span aria-hidden className="size-3 shrink-0 rounded-full border-[1.5px] border-wds-text-faint" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search catalog"
          className="min-w-0 grow bg-transparent font-wds-sans text-wds-body-sm text-wds-text-ink outline-none placeholder:text-wds-text-faint"
        />
      </div>

      <Select value={categoryId ?? 'all'} onValueChange={(v) => onCategoryChange(v === 'all' ? null : v)}>
        <SelectTrigger className="h-8 w-fit gap-wds-1.5 px-wds-3">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={stockFilter === 'low' ? 'low' : 'any'}
        onValueChange={(v) => onStockFilterChange(v === 'low' ? 'low' : 'any')}
      >
        <SelectTrigger className="h-8 w-fit gap-wds-1.5 px-wds-3">
          <SelectValue placeholder="Any stock level" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any stock level</SelectItem>
          <SelectItem value="low">Low stock only</SelectItem>
        </SelectContent>
      </Select>

      <div className="grow" />

      <button
        type="button"
        onClick={() => onStockFilterChange(stockFilter === 'low' ? 'any' : 'low')}
        className={cn(
          'flex h-8 shrink-0 items-center gap-wds-2 rounded-wds-sm border px-wds-3 font-wds-sans text-wds-body-sm font-medium transition-colors',
          stockFilter === 'low'
            ? 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg'
            : 'border-wds-border-strong bg-wds-surface text-wds-text-copy-muted hover:bg-wds-neutral-50'
        )}
      >
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-wds-warning-fg" />
        Low stock only
      </button>
    </div>
  );
}

function DesktopRow({
  row,
  checked,
  onToggle,
}: {
  row: PurchaseCatalogRow;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        'flex h-11 shrink-0 items-center gap-wds-3 border-b border-wds-neutral-100 bg-wds-surface px-wds-3.5 last:border-b-0'
      )}
    >
      <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`Select ${row.itemName}`} />
      <button type="button" onClick={onToggle} className="flex min-w-0 grow flex-col items-start gap-px text-left">
        <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{row.itemName}</span>
        <span className="truncate font-wds-mono text-wds-label text-wds-text-faint">
          {shortUnit(row.buyUnit)}
          {row.packLabel ? ` · ${row.packLabel}` : ''}
        </span>
      </button>
      <span className="w-[120px] shrink-0 font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{row.categoryName}</span>
      <span className="flex w-[110px] shrink-0 items-center justify-end gap-wds-1.5">
        {row.onHandQty !== null ? (
          <>
            <StockDot tone={row.isBelowLevel ? 'low' : 'ok'} />
            <span
              className={cn(
                'font-wds-mono text-wds-body-sm',
                row.isBelowLevel ? 'text-wds-warning-fg' : 'text-wds-text-copy-muted'
              )}
            >
              {row.onHandQty} {shortUnit(row.buyUnit)}
            </span>
          </>
        ) : (
          <span className="font-wds-mono text-wds-body-sm text-wds-text-faint">—</span>
        )}
      </span>
      <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-faint">
        {row.parLevel !== null ? `${row.parLevel} ${shortUnit(row.buyUnit)}` : '—'}
      </span>
    </div>
  );
}

function DesktopCatalog({ rows, selectedIds, onToggle }: Pick<PurchaseCatalogPickerProps, 'rows' | 'selectedIds' | 'onToggle'>) {
  const allChecked = rows.length > 0 && rows.every((r) => selectedIds.has(r.inventoryItemId));

  return (
    <div className="flex grow flex-col overflow-hidden rounded-wds-md border border-wds-border">
      <div className="flex h-8 shrink-0 items-center gap-wds-3 border-b border-wds-text-ink bg-wds-table-header-bg px-wds-3.5">
        <Checkbox
          checked={allChecked}
          onCheckedChange={() => rows.forEach((r) => onToggle(r))}
          aria-label="Select all visible items"
        />
        <span className="grow font-wds-mono text-wds-table-label uppercase text-wds-text-ink">
          Item
        </span>
        <span className="w-[120px] shrink-0 font-wds-mono text-wds-table-label uppercase text-wds-text-ink">
          Category
        </span>
        <span className="w-[110px] shrink-0 text-right font-wds-mono text-wds-table-label uppercase text-wds-text-ink">
          On hand
        </span>
        <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-table-label uppercase text-wds-text-ink">
          Par
        </span>
      </div>
      <div className="flex min-h-0 grow flex-col overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex grow items-center justify-center p-wds-6 font-wds-sans text-wds-body-sm text-wds-text-faint">
            No items match these filters.
          </div>
        ) : (
          rows.map((row) => (
            <DesktopRow
              key={row.inventoryItemId}
              row={row}
              checked={selectedIds.has(row.inventoryItemId)}
              onToggle={() => onToggle(row)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Mobile */

function MobileRow({ row, checked, onToggle }: { row: PurchaseCatalogRow; checked: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      className="flex w-full cursor-pointer items-center gap-wds-3 border-b border-wds-neutral-100 py-wds-3.5 px-4 text-left"
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        className="size-5"
        aria-label={`Select ${row.itemName}`}
      />
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <span className="font-wds-sans text-wds-section font-medium text-wds-text-ink">{row.itemName}</span>
        <span className="font-wds-mono text-wds-caption text-wds-text-faint">
          {row.categoryName} · {row.buyUnit}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {row.onHandQty !== null ? (
          <div className="flex items-center gap-wds-1.5">
            <StockDot tone={row.isBelowLevel ? 'low' : 'ok'} />
            <span
              className={cn(
                'font-wds-mono text-wds-body-sm',
                row.isBelowLevel ? 'text-wds-warning-fg' : 'text-wds-text-copy-muted'
              )}
            >
              {row.onHandQty}
            </span>
          </div>
        ) : (
          <span className="font-wds-mono text-wds-body-sm text-wds-text-faint">—</span>
        )}
        <span className="font-wds-mono text-wds-label text-wds-text-faint">par {row.parLevel ?? '—'}</span>
      </div>
    </div>
  );
}

function MobileFiltersSheet({
  open,
  onOpenChange,
  categoryId,
  onCategoryChange,
  categories,
  stockFilter,
  onStockFilterChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & Pick<
  PurchaseCatalogPickerProps,
  'categoryId' | 'onCategoryChange' | 'categories' | 'stockFilter' | 'onStockFilterChange'
>) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-wds-md">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-wds-4 p-4">
          <div className="flex flex-col gap-wds-1.5">
            <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Category</span>
            <Select value={categoryId ?? 'all'} onValueChange={(v) => onCategoryChange(v === 'all' ? null : v)}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            type="button"
            onClick={() => onStockFilterChange(stockFilter === 'low' ? 'any' : 'low')}
            className={cn(
              'flex h-10 items-center gap-wds-2 rounded-wds-sm border px-wds-3 font-wds-sans text-wds-body font-medium transition-colors',
              stockFilter === 'low'
                ? 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg'
                : 'border-wds-border-strong bg-wds-surface text-wds-text-copy-muted'
            )}
          >
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-wds-warning-fg" />
            Low stock only
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MobileCatalog({
  rows,
  selectedIds,
  onToggle,
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  categories,
  stockFilter,
  onStockFilterChange,
}: Pick<
  PurchaseCatalogPickerProps,
  | 'rows'
  | 'selectedIds'
  | 'onToggle'
  | 'search'
  | 'onSearchChange'
  | 'categoryId'
  | 'onCategoryChange'
  | 'categories'
  | 'stockFilter'
  | 'onStockFilterChange'
>) {
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-wds-2 border-b border-wds-border bg-wds-canvas py-3.5 px-4">
        <div className="flex h-9 grow items-center gap-wds-1.5 rounded-wds-sm border border-wds-border-strong px-wds-3">
          <span aria-hidden className="size-[13px] shrink-0 rounded-full border-[1.5px] border-wds-text-faint" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search catalog"
            className="min-w-0 grow bg-transparent font-wds-sans text-wds-body text-wds-text-ink outline-none placeholder:text-wds-text-faint"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="flex h-9 shrink-0 items-center gap-wds-1.5 rounded-wds-sm border border-wds-border-strong px-wds-3 font-wds-sans text-wds-body-sm font-medium text-wds-text-ink"
        >
          <SlidersHorizontal className="size-3.5" aria-hidden />
          Filters
        </button>
      </div>
      <div className="flex shrink-0 items-center bg-wds-canvas pb-3.5 px-4">
        <button
          type="button"
          onClick={() => onStockFilterChange(stockFilter === 'low' ? 'any' : 'low')}
          className={cn(
            'flex h-7 items-center gap-wds-1.5 rounded-full border px-wds-2.5 font-wds-sans text-wds-caption font-medium transition-colors',
            stockFilter === 'low'
              ? 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg'
              : 'border-wds-border-strong bg-wds-surface text-wds-text-copy-muted'
          )}
        >
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-wds-warning-fg" />
          Low stock only
        </button>
      </div>
      <div className="flex min-h-0 grow flex-col overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex grow items-center justify-center p-6 font-wds-sans text-wds-body-sm text-wds-text-faint">
            No items match these filters.
          </div>
        ) : (
          rows.map((row) => (
            <MobileRow
              key={row.inventoryItemId}
              row={row}
              checked={selectedIds.has(row.inventoryItemId)}
              onToggle={() => onToggle(row)}
            />
          ))
        )}
      </div>
      <MobileFiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        categoryId={categoryId}
        onCategoryChange={onCategoryChange}
        categories={categories}
        stockFilter={stockFilter}
        onStockFilterChange={onStockFilterChange}
      />
    </div>
  );
}

/* ------------------------------------------------------------ Exported */

export function PurchaseCatalogPickerDesktop(props: PurchaseCatalogPickerProps) {
  return (
    <div className={cn('flex min-h-0 grow flex-col gap-wds-3.5', props.className)}>
      <DesktopFilterBar {...props} />
      <DesktopCatalog {...props} />
    </div>
  );
}

export function PurchaseCatalogPickerMobile(props: PurchaseCatalogPickerProps) {
  return <MobileCatalog {...props} />;
}
