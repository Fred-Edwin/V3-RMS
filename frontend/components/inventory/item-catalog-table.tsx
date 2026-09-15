import * as React from 'react';

import { cn } from '@/lib/cn';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui2/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui2/dropdown-menu';
import { Badge } from '@/components/ui2/badge';

/**
 * Item Catalog Table — desktop table + mobile card list, Item Catalog
 * screen. Reference: Paper page `B-0`, `SFT-0` (desktop: toolbar + header +
 * rows) / `TN1-0` (mobile: card list, "1m · Item catalog").
 *
 * This is the composite that actually exercises the `Table` primitive with
 * real content — the toolbar, per-type status dot, and the retired-row
 * 55%-opacity state were deliberately left out of the bare primitive (see
 * its own Status entry) and belong here instead.
 */

export type ItemType = 'raw' | 'stocked' | 'prepped';

const typeDotClass: Record<ItemType, string> = {
  raw: 'bg-wds-neutral-400',
  stocked: 'bg-wds-info-fg',
  prepped: 'bg-wds-success-fg',
};
const typeLabel: Record<ItemType, string> = {
  raw: 'Raw ingredient',
  stocked: 'Stocked item',
  prepped: 'Prepped item',
};

export interface ItemCatalogRow {
  id: string;
  name: string;
  type: ItemType;
  category: string;
  units: string;
  pack: string;
  departmentScope: string;
  retired?: boolean;
}

/* ------------------------------------------------------------- Toolbar */

export interface ItemCatalogToolbarProps {
  itemCount: number;
  onManageCategories?: () => void;
  className?: string;
}

/**
 * "Items {count}" + Type/Department/Category filter chips + Show retired
 * toggle + Manage categories link. Reference: `SHQ-0`.
 */
export function ItemCatalogToolbar({ itemCount, onManageCategories, className }: ItemCatalogToolbarProps) {
  return (
    <div
      className={cn(
        'flex h-10 shrink-0 items-center gap-wds-2 border-b border-wds-border px-wds-4',
        className
      )}
    >
      <span className="font-wds-sans text-wds-label text-wds-text-ink">Items</span>
      <Badge variant="neutral">{itemCount}</Badge>
      <div className="ml-auto flex gap-wds-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-wds-sm border border-wds-border-strong px-wds-2 py-0.5 font-wds-sans text-wds-caption text-wds-text-ink">
              Type &#9662;
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Raw ingredient</DropdownMenuItem>
            <DropdownMenuItem>Prepped item</DropdownMenuItem>
            <DropdownMenuItem>Stocked item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-wds-sm border border-wds-border-strong px-wds-2 py-0.5 font-wds-sans text-wds-caption text-wds-text-ink">
              Department &#9662;
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Kitchen</DropdownMenuItem>
            <DropdownMenuItem>Barista</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button className="rounded-wds-sm border border-wds-border-strong px-wds-2 py-0.5 font-wds-sans text-wds-caption text-wds-text-muted">
          Show retired
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-wds-sm border border-wds-border-strong px-wds-2 py-0.5 font-wds-sans text-wds-caption text-wds-text-ink">
              Category &#9662;
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Dry goods</DropdownMenuItem>
            <DropdownMenuItem>Dairy</DropdownMenuItem>
            <DropdownMenuItem>Beverages</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="mx-0.5 h-[18px] w-px shrink-0 bg-wds-border-strong" aria-hidden />
        <button
          type="button"
          onClick={onManageCategories}
          className="rounded-wds-sm border border-wds-border-strong px-wds-2 py-0.5 font-wds-sans text-wds-caption font-medium text-wds-primary"
        >
          Manage categories
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Table */

export interface ItemCatalogTableProps {
  rows: ItemCatalogRow[];
  className?: string;
}

/**
 * Desktop table body. Column widths match `SFT-0` exactly: Name (flex,
 * min 180px) · Type (120px) · Category (140px) · Units (160px) · Pack
 * (110px, right-aligned) · Department scope (250px, `pl-6`/24px indent —
 * confirmed via `get_computed_styles` on `SH9-0`, not a stray margin).
 * Retired rows: whole row at 55% opacity (`SFU-0`), not just the name text.
 */
export function ItemCatalogTable({ rows, className }: ItemCatalogTableProps) {
  return (
    <Table className={cn('table-fixed', className)}>
      <TableHeader>
        <TableRow className="h-[30px] hover:bg-wds-table-header-bg">
          <TableHead className="min-w-[180px]">Name</TableHead>
          <TableHead className="w-[120px] shrink-0">Type</TableHead>
          <TableHead className="w-[140px] shrink-0">Category</TableHead>
          <TableHead className="w-[160px] shrink-0">Units</TableHead>
          <TableHead className="w-[110px] shrink-0 text-right">Pack</TableHead>
          <TableHead className="w-[250px] shrink-0 pl-wds-6">Department scope</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} className={row.retired ? 'opacity-55' : undefined}>
            <TableCell className="min-w-[180px] font-medium text-wds-text-ink">{row.name}</TableCell>
            <TableCell className="w-[120px] shrink-0">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-wds-caption text-wds-text-muted">
                <span className={cn('size-1.5 shrink-0 rounded-wds-full', typeDotClass[row.type])} aria-hidden />
                {typeLabel[row.type]}
              </span>
            </TableCell>
            <TableCell className="w-[140px] shrink-0 text-wds-caption text-wds-text-ink">
              {row.category}
            </TableCell>
            <TableCell className="w-[160px] shrink-0 whitespace-nowrap font-wds-mono text-wds-caption text-wds-text-muted">
              {row.units}
            </TableCell>
            <TableCell className="w-[110px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-muted">
              {row.pack}
            </TableCell>
            <TableCell className="w-[250px] shrink-0 pl-wds-6 text-wds-caption text-wds-text-faint">
              {row.departmentScope}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* --------------------------------------------------------------- Mobile */

export interface ItemCatalogListProps {
  rows: ItemCatalogRow[];
  className?: string;
}

/**
 * Mobile card list — not a table. Each row: name + units on top, dot +
 * "Type · Category · Scope" caption below. Reference: `TN1-0`/`TN2-0`.
 * Units shows only the base unit/conversion arrow, dropping the trailing
 * " · ÷N" / " · no conversion" suffix desktop's UNITS column keeps —
 * Paper's own mobile card (`TN1-0`) draws bare units, a deliberate
 * space-saving simplification confirmed against the desktop node (`SFT-0`),
 * which keeps the fuller string. Retired rows also swap the caption to just
 * the retirement note, matching Paper's retired-row caption exactly.
 */
export function ItemCatalogList({ rows, className }: ItemCatalogListProps) {
  return (
    <div className={cn('flex flex-col rounded-wds-md border border-wds-border bg-wds-surface', className)}>
      {rows.map((row) => (
        <div
          key={row.id}
          className={cn(
            'flex flex-col gap-1 border-b border-wds-border p-wds-3 last:border-b-0',
            row.retired && 'opacity-55'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-wds-sans text-wds-body font-medium text-wds-text-ink">{row.name}</span>
            <span className="font-wds-mono text-wds-caption text-wds-text-muted">
              {row.units.split(' · ')[0]}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn('size-1.5 shrink-0 rounded-wds-full', typeDotClass[row.type])} aria-hidden />
            <span className="font-wds-sans text-wds-caption text-wds-text-muted">
              {row.retired
                ? row.departmentScope
                : `${typeLabel[row.type]} · ${row.category} · ${row.departmentScope}`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
