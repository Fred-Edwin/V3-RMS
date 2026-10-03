'use client';

import * as React from 'react';

import { SearchInput } from '@/components/ui2/search-input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { listItems } from '@/features/inventory';
import type { DepartmentTag } from '../types';

export interface AddItemPick {
  inventoryItemId: string;
  itemName: string;
  usageUnit: string;
  categoryName: string | null;
  parentCategoryName: string | null;
}

export interface AddItemSheetProps {
  open: boolean;
  onClose: () => void;
  departmentTag: DepartmentTag;
  onPick: (item: AddItemPick) => void;
}

/**
 * "+ Add an item" — a lightweight bottom sheet listing the caller's
 * department-scoped catalog (`GET /inventory/items?departmentTag=…`), search
 * as you type. Not a Paper-drawn node this session (the six fill-screen
 * states don't show the picker open) — built to the same mobile full-screen
 * sheet idiom the rest of this feature uses.
 */
export function AddItemSheet({ open, onClose, departmentTag, onPick }: AddItemSheetProps) {
  const [search, setSearch] = React.useState('');
  const [results, setResults] = React.useState<
    { id: string; name: string; usageUnit: string; category: { id: string; name: string } | null }[]
  >([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let stale = false;
    setLoading(true);
    void listItems({ search: search || undefined, departmentTag, perPage: 50 })
      .then((res) => {
        if (stale) return;
        setResults(res.data);
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [open, search, departmentTag]);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="bottom" className="flex h-[100dvh] flex-col rounded-t-none">
        <SheetHeader>
          <SheetTitle>Add an item</SheetTitle>
        </SheetHeader>
        <div className="p-4">
          <SearchInput placeholder="Search your items" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center font-wds-sans text-wds-caption text-wds-text-muted">Loading…</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center font-wds-sans text-wds-caption text-wds-text-muted">No items found.</div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  onPick({
                    inventoryItemId: item.id,
                    itemName: item.name,
                    usageUnit: item.usageUnit,
                    categoryName: item.category?.name ?? null,
                    parentCategoryName: null,
                  })
                }
                className="flex w-full flex-col gap-0.5 border-b border-wds-border px-4 py-3 text-left"
              >
                <span className="font-wds-sans text-wds-body font-medium text-wds-text-ink">{item.name}</span>
                <span className="font-wds-mono text-wds-label text-wds-neutral-500">{item.usageUnit}</span>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
