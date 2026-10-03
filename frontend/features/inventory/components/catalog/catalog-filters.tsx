import * as React from 'react';

import { cn } from '@/lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui2/dropdown-menu';
import type { InventoryItemType } from '../../types';
import { ITEM_TYPE_LABEL, ITEM_TYPE_ORDER } from '../../lib/item-labels';

const chipBase =
  'inline-flex h-[30px] shrink-0 items-center gap-1.5 whitespace-nowrap px-3 font-wds-sans text-[13px] leading-4 transition-[background-color,border-color,transform] duration-150 focus-visible:outline-none focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]';
const chipOutline = cn(chipBase, 'rounded-wds-sm border border-wds-border-strong bg-white text-wds-text-ink hover:bg-wds-neutral-50');

function Count({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary', className)}>{children}</span>;
}

export interface FilterOption {
  value: string;
  label: string;
}

function MenuChip({
  label,
  allLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string | null;
  options: FilterOption[];
  onChange: (value: string | null) => void;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(chipOutline, selected && 'border-wds-selected-edge bg-wds-espresso-50 font-medium')}>
          {selected ? selected.label : label} <span aria-hidden>▾</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {value ? <DropdownMenuItem onSelect={() => onChange(null)}>{allLabel}</DropdownMenuItem> : null}
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => onChange(option.value)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface CatalogFiltersProps {
  /** Items tracked, shown beside "All". */
  total: number | null;
  /** Live items per type, for the counts on the chips; omitted until loaded. */
  typeCounts?: Record<InventoryItemType, number>;
  /** Another filter is on (Low or out): "All" is then not the active chip. */
  otherFilterOn?: boolean;
  /** "All": back to every item — type, Needs setup and Low or out off. */
  onShowAll: () => void;
  type: InventoryItemType | null;
  onTypeChange: (type: InventoryItemType | null) => void;
  needsSetup: boolean;
  needsSetupCount: number | null;
  onNeedsSetupChange: (on: boolean) => void;
  categoryOptions: FilterOption[];
  categoryId: string | null;
  onCategoryChange: (id: string | null) => void;
  departmentOptions: FilterOption[];
  departmentTag: string | null;
  onDepartmentChange: (tag: string | null) => void;
  showRetired: boolean;
  onShowRetiredChange: (on: boolean) => void;
  /** Store Manager only: opens Manage categories. */
  onManageCategories?: () => void;
  className?: string;
}

/**
 * The filter row under the strip: All / type chips / Needs setup on the left;
 * Category, Department, Show retired and Manage categories on the right.
 */
export function CatalogFilters({
  total,
  typeCounts,
  otherFilterOn = false,
  onShowAll,
  type,
  onTypeChange,
  needsSetup,
  needsSetupCount,
  onNeedsSetupChange,
  categoryOptions,
  categoryId,
  onCategoryChange,
  departmentOptions,
  departmentTag,
  onDepartmentChange,
  showRetired,
  onShowRetiredChange,
  onManageCategories,
  className,
}: CatalogFiltersProps) {
  const allActive = type === null && !needsSetup && !otherFilterOn;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <button
        type="button"
        aria-pressed={allActive}
        onClick={onShowAll}
        className={cn(
          chipBase,
          allActive
            ? 'rounded-wds-sm bg-wds-text-ink font-medium text-white'
            : 'rounded-wds-sm border border-wds-border-strong bg-white text-wds-text-ink hover:bg-wds-neutral-50'
        )}
      >
        All
        {total !== null ? <Count className={allActive ? 'text-[#B5AEA5]' : undefined}>{total}</Count> : null}
      </button>
      {ITEM_TYPE_ORDER.map((t) => {
        const active = type === t;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onNeedsSetupChange(false);
              onTypeChange(active ? null : t);
            }}
            className={cn(chipOutline, active && 'border-wds-text-ink bg-wds-text-ink font-medium text-white hover:bg-wds-text-ink')}
          >
            {ITEM_TYPE_LABEL[t]}
            {typeCounts ? <Count className={active ? 'text-[#B5AEA5]' : undefined}>{typeCounts[t]}</Count> : null}
          </button>
        );
      })}
      <span aria-hidden className="h-5 w-px shrink-0 bg-wds-border-strong" />
      <button
        type="button"
        aria-pressed={needsSetup}
        onClick={() => onNeedsSetupChange(!needsSetup)}
        className={cn(
          chipBase,
          'rounded-wds-sm border font-medium',
          needsSetup
            ? 'border-wds-warning-fg bg-wds-warning-fg text-white'
            : 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg hover:border-wds-warning-fg'
        )}
      >
        <span aria-hidden className={cn('size-1.5 shrink-0 rounded-[3px]', needsSetup ? 'bg-white' : 'bg-wds-warning-fg')} />
        Needs setup
        {needsSetupCount !== null ? (
          <Count className={needsSetup ? 'text-white' : 'text-wds-warning-fg'}>{needsSetupCount}</Count>
        ) : null}
      </button>
      <span className="grow" />
      <MenuChip label="Category" allLabel="All categories" value={categoryId} options={categoryOptions} onChange={onCategoryChange} />
      <MenuChip label="Department" allLabel="All departments" value={departmentTag} options={departmentOptions} onChange={onDepartmentChange} />
      <button
        type="button"
        aria-pressed={showRetired}
        onClick={() => onShowRetiredChange(!showRetired)}
        className={cn(
          chipBase,
          'rounded-wds-sm hover:text-wds-text-ink',
          showRetired ? 'font-medium text-wds-text-ink underline underline-offset-4' : 'text-wds-text-secondary'
        )}
      >
        Show retired
      </button>
      {onManageCategories ? (
        <button
          type="button"
          onClick={onManageCategories}
          className={cn(chipOutline, 'font-medium text-wds-espresso-700')}
        >
          Manage categories
        </button>
      ) : null}
    </div>
  );
}
