'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import type { InventoryItem } from '../types';
import type { RecentSupplierItem } from '../types/receiving';

/**
 * New Purchase's item picker (2026-09-17 UI refinement) — replaces a plain
 * `<Select>` scrollable dropdown over the whole catalog with a type-to-filter
 * combobox, surfacing "Recently purchased from this supplier" first when a
 * supplier is selected. Not built on the shared `components/ui2/combobox.tsx`
 * primitive: that one only supports a flat option list, and adding a
 * sectioned "Recent" group to its contract would change behavior for its one
 * other consumer (`item-form.tsx`'s plain category/supplier pickers) for a
 * need only this screen has. Same visual language (input + floating listbox,
 * same keyboard conventions) so it reads as the same field family.
 */
export interface ItemPickerComboboxProps {
  value: string;
  onValueChange: (itemId: string) => void;
  items: InventoryItem[];
  recentItems: RecentSupplierItem[];
  placeholder?: string;
  className?: string;
}

export function ItemPickerCombobox({
  value,
  onValueChange,
  items,
  recentItems,
  placeholder = 'Search items…',
  className,
}: ItemPickerComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [highlighted, setHighlighted] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selected = items.find((i) => i.id === value);
  const displayValue = open ? query : (selected?.name ?? '');

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const recentIds = React.useMemo(() => new Set(recentItems.map((r) => r.inventoryItemId)), [recentItems]);
  const trimmedQuery = query.trim().toLowerCase();

  // Recent items only show as their own section while the field is empty —
  // once the person starts typing, they're filtering the whole catalog, not
  // browsing recents, so recents fold into the same filtered list rather
  // than appearing twice.
  const filteredItems = trimmedQuery ? items.filter((i) => i.name.toLowerCase().includes(trimmedQuery)) : items;
  const recentSection = trimmedQuery ? [] : recentItems.filter((r) => items.some((i) => i.id === r.inventoryItemId));
  const otherItems = trimmedQuery ? filteredItems : filteredItems.filter((i) => !recentIds.has(i.id));

  const rows: Array<{ kind: 'recent'; item: RecentSupplierItem } | { kind: 'item'; item: InventoryItem }> = [
    ...recentSection.map((item) => ({ kind: 'recent' as const, item })),
    ...otherItems.map((item) => ({ kind: 'item' as const, item })),
  ];

  const commit = (itemId: string) => {
    onValueChange(itemId);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery('');
          setHighlighted(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlighted(0);
          if (!open) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
            inputRef.current?.blur();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted((h) => Math.min(h + 1, rows.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const row = rows[highlighted];
            if (row) commit(row.kind === 'recent' ? row.item.inventoryItemId : row.item.id);
          }
        }}
        className={cn(
          'flex h-7 w-full items-center rounded-wds-sm border-none bg-transparent px-0 font-wds-sans text-wds-body-sm text-wds-text-ink outline-none transition-colors',
          'placeholder:text-wds-text-muted',
          'focus-visible:bg-wds-neutral-50 focus-visible:shadow-wds-ring',
          className
        )}
      />
      {open && (rows.length > 0 || items.length === 0) ? (
        <div className="absolute z-50 mt-1 max-h-72 w-72 overflow-y-auto rounded-wds-md border border-wds-border bg-wds-surface p-wds-1 shadow-wds-md">
          {items.length === 0 ? (
            <div className="px-wds-2 py-wds-2 font-wds-sans text-wds-caption text-wds-text-faint">No items available</div>
          ) : rows.length === 0 ? (
            <div className="px-wds-2 py-wds-2 font-wds-sans text-wds-caption text-wds-text-faint">No matching items</div>
          ) : (
            <>
              {recentSection.length > 0 ? (
                <div className="px-wds-2 pb-wds-1 pt-wds-1.5 font-wds-mono text-wds-field-label uppercase text-wds-text-faint">
                  Recently purchased
                </div>
              ) : null}
              {rows.map((row, i) => {
                const isRecentBoundary = i === recentSection.length && recentSection.length > 0 && otherItems.length > 0;
                const itemId = row.kind === 'recent' ? row.item.inventoryItemId : row.item.id;
                const name = row.kind === 'recent' ? row.item.itemName : row.item.name;
                return (
                  <React.Fragment key={itemId}>
                    {isRecentBoundary ? (
                      <div className="px-wds-2 pb-wds-1 pt-wds-2 font-wds-mono text-wds-field-label uppercase text-wds-text-faint">
                        All items
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => commit(itemId)}
                      onMouseEnter={() => setHighlighted(i)}
                      className={cn(
                        'flex w-full cursor-default select-none items-center justify-between gap-wds-2 rounded-wds-sm px-wds-2 py-wds-1.5 text-left font-wds-sans text-wds-body-sm text-wds-text-ink',
                        i === highlighted && 'bg-wds-neutral-100'
                      )}
                    >
                      <span className="min-w-0 truncate">{name}</span>
                      {row.kind === 'recent' ? (
                        <span className="shrink-0 font-wds-mono text-wds-caption text-wds-text-faint">
                          KES {Number(row.item.lastUnitPrice).toLocaleString()}
                        </span>
                      ) : null}
                    </button>
                  </React.Fragment>
                );
              })}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
