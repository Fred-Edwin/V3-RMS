'use client';

import * as React from 'react';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { SearchInput } from '@/components/ui2/search-input';
import { Skeleton } from '@/components/ui2/skeleton';
import { ErrorState } from '@/components/app/shell/shell-states';
import { formatApiErrorMessage } from '@/types/api';
import { listItems } from '../../../catalog/services/inventory-api-service';
import type { InventoryItemListRow } from '../../../types';

/**
 * "+ Add something else you used": a searchable list of live catalog items (raw ingredients and other prepped items: two-stage
 * prep is allowed) that are not already on the form and are not the item being made. A bottom sheet on a phone and tablet, and the
 * same sheet in the manager's drawer.
 */
export function IngredientPicker({
  open,
  onOpenChange,
  excludeItemIds,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeItemIds: string[];
  onPick: (item: { itemId: string; name: string; unit: string }) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [rows, setRows] = React.useState<InventoryItemListRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    let stale = false;
    setError(null);
    const timer = setTimeout(() => {
      listItems({ search: query.trim() || undefined, perPage: 30 })
        .then((res) => {
          if (!stale) setRows(res.data);
        })
        .catch((err) => {
          if (!stale) setError(formatApiErrorMessage(err, "Couldn't load items."));
        });
    }, query ? 250 : 0);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [open, query, attempt]);

  const shown = (rows ?? []).filter((r) => !excludeItemIds.includes(r.id));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 sm:mx-auto sm:max-w-[520px]">
        <SheetHeader className="border-b-0 px-wds-4 pb-wds-3">
          <SheetTitle className="text-[20px] font-semibold leading-6">What else did you use?</SheetTitle>
          <SheetDescription>Pick an item from the catalog.</SheetDescription>
        </SheetHeader>
        <div className="px-wds-4 pb-wds-3">
          <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items" aria-label="Search items" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-wds-4 pb-wds-4">
          {error ? (
            <ErrorState title="Couldn't load items" description={error} onRetry={() => setAttempt((n) => n + 1)} />
          ) : rows === null ? (
            <div className="flex flex-col gap-wds-3 py-wds-2" aria-busy="true" aria-label="Loading items">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="py-wds-6 text-center font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{query ? `No item matches “${query}”.` : 'No other items to add.'}</p>
          ) : (
            <ul>
              {shown.map((r) => (
                <li key={r.id} className="border-b border-wds-neutral-100 last:border-b-0">
                  <button type="button" onClick={() => onPick({ itemId: r.id, name: r.name, unit: r.usageUnit })} className="flex min-h-12 w-full items-center justify-between gap-wds-3 py-wds-2 text-left outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring">
                    <span className="truncate font-wds-sans text-[16px] leading-5 text-wds-text-ink">{r.name}</span>
                    <span className="shrink-0 font-wds-mono text-wds-caption text-wds-text-copy-muted">{r.usageUnit}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
