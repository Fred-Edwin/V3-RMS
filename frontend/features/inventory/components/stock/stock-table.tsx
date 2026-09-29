'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui2/dropdown-menu';
import type { InventoryItemTypeValue, StockRow } from '../../types/stock';
import { formatKes, formatNumber, formatQty, ITEM_TYPE_DOT_CLASS, ITEM_TYPE_LABEL } from './stock-format';

/**
 * Stock table pieces shared by the hub attention table (`1AYW-0`) and All
 * items (`1B5U-0` desktop / `1BRS-0` mobile) — same columns, same row spec.
 */

export const LEDGER_HREF = (itemId: string) => `/app/inventory/stock/ledger/${itemId}`;

/**
 * Filter chip / dropdown trigger sizes:
 *  - `sm`: the hub band's compact chips (caption, 2px/8px).
 *  - `md`: All items desktop toolbar (`1B8S-0`: 13px, 6px/10px, border).
 *  - `mobile`: All items mobile (`1BSH-0`: 12px, 6px/10px, border-strong, 4px radius).
 */
export type FilterChipSize = 'sm' | 'md' | 'mobile';

const chipSizeClass: Record<FilterChipSize, string> = {
  sm: 'rounded-wds-sm px-2 py-0.5 text-wds-caption',
  md: 'rounded-wds-sm px-2.5 py-1.5 text-[13px]/4',
  mobile: 'touch-manipulation rounded-wds-md px-2.5 py-1.5 text-[12px]/4',
};

function chipStateClass(pressed: boolean, size: FilterChipSize) {
  return pressed
    ? 'border-wds-primary bg-wds-primary text-wds-primary-fg'
    : cn(size === 'md' ? 'border-wds-border' : 'border-wds-border-strong', 'bg-wds-surface text-wds-text-ink hover:bg-wds-neutral-100');
}

export function FilterChip({
  pressed,
  onClick,
  size = 'sm',
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  size?: FilterChipSize;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'shrink-0 border font-wds-sans outline-none transition-[background-color,border-color,color] duration-200 ease-out focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]',
        chipSizeClass[size],
        chipStateClass(pressed, size),
      )}
    >
      {children}
    </button>
  );
}

const TYPE_OPTIONS: { value: InventoryItemTypeValue; label: string }[] = [
  { value: 'STOCKED', label: 'Stocked' },
  { value: 'PREPPED', label: 'Prepped' },
  { value: 'RAW_INGREDIENT', label: 'Raw ingredient' },
];

/** Single-select dropdown filter drawn as a chip ("Type ▾", "Category ▾"). */
export function DropdownFilter<T extends string>({
  label,
  allLabel,
  value,
  options,
  onChange,
  size = 'sm',
}: {
  label: string;
  allLabel: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T | undefined) => void;
  size?: FilterChipSize;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex shrink-0 items-center gap-1 border font-wds-sans outline-none transition-[background-color,border-color,color] duration-150 focus-visible:shadow-wds-ring',
          chipSizeClass[size],
          chipStateClass(Boolean(selected), size),
        )}
      >
        {selected ? selected.label : label}
        <ChevronDown className="size-3" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[320px] overflow-y-auto">
        <DropdownMenuRadioGroup value={value ?? '__all'} onValueChange={(v) => onChange(v === '__all' ? undefined : (v as T))}>
          <DropdownMenuRadioItem value="__all">{allLabel}</DropdownMenuRadioItem>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TypeFilter({
  value,
  onChange,
  size = 'sm',
}: {
  value: InventoryItemTypeValue | undefined;
  onChange: (v: InventoryItemTypeValue | undefined) => void;
  size?: FilterChipSize;
}) {
  return <DropdownFilter label="Type" allLabel="All types" value={value} options={TYPE_OPTIONS} onChange={onChange} size={size} />;
}

/** One stock row — shared by the hub attention table and All items (`1AYW-0` / `1B5U-0` row spec). */
export function StockTableRow({ row, last = false }: { row: StockRow; last?: boolean }) {
  const qtyTone = row.isNegative ? 'font-medium text-wds-error-fg' : row.isLow ? 'font-medium text-wds-warning-fg' : 'text-wds-text-ink';
  return (
    <Link
      href={LEDGER_HREF(row.itemId)}
      className={cn(
        'group/row flex h-11 shrink-0 items-center px-4 outline-none transition-colors duration-150 hover:bg-wds-neutral-100 focus-visible:bg-wds-neutral-100 focus-visible:shadow-[inset_2px_0_0_var(--wds-primary)]',
        !last && 'border-b border-wds-neutral-100',
      )}
    >
      <span className="min-w-0 grow truncate font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{row.name}</span>
      <span className="flex w-[130px] shrink-0 items-center gap-1.5">
        <span className={cn('size-1.5 shrink-0 rounded-full', ITEM_TYPE_DOT_CLASS[row.type])} aria-hidden />
        <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{ITEM_TYPE_LABEL[row.type]}</span>
      </span>
      <span className={cn('w-[110px] shrink-0 text-right font-wds-mono text-wds-body-sm', qtyTone)}>{formatQty(row.onHand, row.usageUnit)}</span>
      <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-copy-muted">
        {row.restockLevel ? formatNumber(row.restockLevel) : '—'}
      </span>
      <span className="w-[100px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-copy-muted">{formatNumber(row.currentCost)}</span>
      <span className={cn('w-[120px] shrink-0 text-right font-wds-mono text-wds-body-sm', row.isNegative ? 'font-medium text-wds-error-fg' : 'text-wds-text-ink')}>
        {formatKes(row.value)}
      </span>
      <span
        className="w-7 shrink-0 text-right font-wds-sans text-wds-body text-wds-text-faint transition-transform duration-150 ease-out group-hover/row:translate-x-0.5"
        aria-hidden
      >
        ›
      </span>
    </Link>
  );
}

/** Column header row, `1B2K-0` / `1B99-0` — structural hairline in neutral-800. */
export function StockTableHeader() {
  const h = 'font-wds-mono text-wds-field-label font-semibold uppercase text-wds-text-ink';
  return (
    <div className="flex h-[30px] shrink-0 items-center border-b border-wds-neutral-800 px-4" role="presentation">
      <span className={cn('grow', h)}>Item</span>
      <span className={cn('w-[130px] shrink-0', h)}>Type</span>
      <span className={cn('w-[110px] shrink-0 text-right', h)}>On hand</span>
      <span className={cn('w-[90px] shrink-0 text-right leading-3', h)}>Restock level</span>
      <span className={cn('w-[100px] shrink-0 text-right', h)}>Cost</span>
      <span className={cn('w-[120px] shrink-0 text-right', h)}>Value</span>
      <span className="w-7 shrink-0" />
    </div>
  );
}

/**
 * Mobile list row — `1BRS-0`: name + on-hand on one baseline, type dot +
 * "restock N · KES value" below. Paper's dots aren't consistent row to row;
 * the rule used: raw ingredient neutral-400, stocked / prepped caramel-500,
 * negative error. Meta line faint, error when negative.
 */
export function MobileStockRow({ row }: { row: StockRow }) {
  const qtyTone = row.isNegative ? 'text-wds-error-fg' : row.isLow ? 'text-wds-warning-fg' : 'text-wds-text-ink';
  const dot = row.isNegative ? 'bg-wds-error-fg' : row.type === 'RAW_INGREDIENT' ? 'bg-wds-neutral-400' : 'bg-wds-caramel-500';
  return (
    <Link
      href={LEDGER_HREF(row.itemId)}
      className="-mx-4 flex flex-col gap-1.5 border-b border-wds-neutral-200 px-4 py-3.5 outline-none transition-colors duration-150 focus-visible:shadow-[inset_2px_0_0_var(--wds-primary)] active:bg-wds-neutral-100"
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-wds-sans text-[15px]/[18px] font-medium text-wds-text-ink">{row.name}</span>
        <span className={cn('shrink-0 font-wds-mono text-[14px]/[18px]', qtyTone)}>{formatQty(row.onHand, row.usageUnit)}</span>
      </span>
      <span className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-[5px]">
          <span className={cn('size-[5px] shrink-0 rounded-full', dot)} aria-hidden />
          <span className="truncate font-wds-sans text-[12px]/4 text-wds-text-copy-muted">{ITEM_TYPE_LABEL[row.type]}</span>
        </span>
        <span className={cn('shrink-0 font-wds-mono text-[12px]/4', row.isNegative ? 'text-wds-error-fg' : 'text-wds-text-faint')}>
          {row.restockLevel ? `restock ${formatNumber(row.restockLevel)} · ` : ''}
          {formatKes(row.value)}
        </span>
      </span>
    </Link>
  );
}
