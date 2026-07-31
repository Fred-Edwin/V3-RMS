'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { InventoryItem } from '@/types/inventory';

interface ItemComboboxProps {
  items: InventoryItem[];
  value: string;
  onChange: (itemId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * Searchable item picker for desktop — replaces a bare native <select> for
 * Prep Entry's output/input pickers and Prep Recipes' item pickers. A flat
 * dropdown doesn't scale past a handful of items (24 in dev today, "way
 * more" in production per the owner) — this adds type-to-filter, matching
 * the searchable bottom-sheet pattern the mobile Prep Entry screen already
 * uses, so both platforms now solve item-selection the same way.
 */
export function ItemCombobox({ items, value, onChange, placeholder, disabled, className, id }: ItemComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => items.find((i) => i.id === value) ?? null, [items, value]);

  const filtered = useMemo(
    () => items.filter((i) => !search.trim() || i.name.toLowerCase().includes(search.trim().toLowerCase())),
    [items, search],
  );

  useEffect(() => {
    if (!open) return;
    setSearch('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-11 w-full items-center gap-2 rounded-sm border-[1.5px] border-stone-200 bg-white pl-3 pr-3 text-body-md text-stone-900 transition-colors duration-fast',
          'focus:outline-none focus-visible:shadow-focus hover:border-stone-300',
          disabled && 'cursor-not-allowed bg-stone-100 opacity-50',
        )}
      >
        {selected ? (
          <span className="min-w-0 flex-1 truncate text-left font-medium">{selected.name}</span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-left text-stone-400">{placeholder ?? 'Select item…'}</span>
        )}
        <ChevronDown size={16} className="shrink-0 text-stone-500" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-[260px] rounded-md border border-stone-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-stone-100 px-3 py-2">
            <Search size={15} className="shrink-0 text-stone-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items…"
              className="w-full text-body-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-body-sm text-stone-500">No items found.</p>
            ) : (
              filtered.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-stone-50"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-label-sm font-semibold tabular-nums text-stone-500">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-medium text-stone-900">{item.name}</p>
                    <p className="text-label-sm text-stone-500">{item.usageUnit}</p>
                  </div>
                  {item.id === value && <Check size={16} className="shrink-0 text-espresso" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
