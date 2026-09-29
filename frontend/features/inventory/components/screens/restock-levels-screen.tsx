'use client';

import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui2/sheet';
import { Button } from '@/components/ui2/button';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { RestockLevelGrid, RestockLevelHelperNote, type RestockLevelRow as GridRow } from '../restock-level-grid';
import { useRestockLevels, type RestockLevelsActor } from '../../hooks/use-restock-levels';
import type { RestockLevelRow } from '../../types';
import { STOCK_DRAWER_MOTION, useReturnFocus } from '../stock/log-waste-drawer';
import { StockMobileHeader } from '../stock/stock-mobile-header';
import { FormErrorBanner, SkeletonRows, StockEmptyCard, StockErrorCard, TableRowSkeleton } from '../stock/stock-states';
import { formatNumber } from '../stock/stock-format';

function toGridRow(row: RestockLevelRow): GridRow {
  return {
    id: row.inventoryItemId,
    name: row.itemName,
    unit: row.usageUnit,
    onHand: Number.parseFloat(row.onHandQty),
    restockLevel: row.level != null ? Number.parseFloat(row.level) : 0,
  };
}

export interface RestockLevelsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: 'desktop' | 'mobile';
  /** Central Store (Store Manager) locationId, or undefined for a Department Head's own department. */
  locationId?: string;
  actor: RestockLevelsActor;
}

const DEFAULT_NOTE =
  'Raising a restock level flags an item low right away if on-hand is below it. Department restock levels are set by each department head, not here.';

/**
 * Restock levels · Central Store — Milestone Six Session 1 upgrade of the
 * Milestone One wrapper, `18ZV-0` (drawer, 440px) / `1BV6-0` (mobile). The
 * grid (`restock-level-grid.tsx`) is unchanged apart from marking changed
 * rows. What the wrapper adds (plan §4.3 "Restock levels"):
 *  - rows = items that have a level, plus ones added with "+ Add an item"
 *    (an inline search over the already-loaded catalog rows);
 *  - changed rows marked; a live note naming the last raised level that
 *    flags its item low; Save disabled until dirty; "Saving…" in flight;
 *  - a failed save is the kit banner at the top of the body, edits kept;
 *  - dirty-guard on close; 250ms drawer motion; focus back to the trigger.
 * Bulk save stays one `PUT` for every edited row (Milestone One rule).
 */
export function RestockLevelsDrawer({ open, onOpenChange, variant, locationId, actor }: RestockLevelsDrawerProps) {
  // Load on open only, and (for the Store Manager) once the Central Store id is known.
  const { rows, changedIds, isDirty, setLevel, save, saving, saveError, discard, status, reload } = useRestockLevels(
    locationId,
    actor,
    open && (actor.role === 'DEPARTMENT_HEAD' || Boolean(locationId)),
  );
  const addToast = useWdsToastStore((s) => s.addToast);
  const returnFocus = useReturnFocus();
  const [added, setAdded] = React.useState<string[]>([]);
  const [lastChanged, setLastChanged] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  // A fresh session every time the drawer opens.
  React.useEffect(() => {
    if (!open) return;
    setAdded([]);
    setLastChanged(null);
    setSearch('');
    setAdding(false);
  }, [open]);

  const changed = React.useMemo(() => new Set(changedIds), [changedIds]);
  const visible = React.useMemo(
    () => rows.filter((r) => r.level != null || added.includes(r.inventoryItemId) || changed.has(r.inventoryItemId)),
    [rows, added, changed],
  );
  const addable = React.useMemo(() => rows.filter((r) => !visible.includes(r)), [rows, visible]);
  const query = search.trim().toLowerCase();
  const shown = query ? visible.filter((r) => r.itemName.toLowerCase().includes(query)) : visible;

  // The live note (§4.3): the most recent edit that flags its item low right away.
  const lastRow = lastChanged ? rows.find((r) => r.inventoryItemId === lastChanged) : undefined;
  const lastLevel = lastRow?.level != null ? Number.parseFloat(lastRow.level) : null;
  const lastOnHand = lastRow ? Number.parseFloat(lastRow.onHandQty) : null;
  const note =
    lastRow && lastLevel !== null && lastOnHand !== null && lastLevel > lastOnHand
      ? `Raising ${lastRow.itemName} restock level to ${formatNumber(lastLevel)} ${lastRow.usageUnit} flags it low right away (${formatNumber(lastOnHand)} on hand). Department restock levels are set by each department head, not here.`
      : DEFAULT_NOTE;

  const close = React.useCallback(() => {
    discard();
    onOpenChange(false);
  }, [discard, onOpenChange]);
  const requestClose = React.useCallback(() => {
    if (saving) return;
    if (isDirty) setConfirmOpen(true);
    else close();
  }, [saving, isDirty, close]);

  const handleSave = async () => {
    if (!isDirty || saving) return;
    const count = changedIds.length;
    const ok = await save();
    if (ok) {
      addToast({ variant: 'success', title: 'Restock levels saved', description: `${count} ${count === 1 ? 'item' : 'items'} updated at the Central Store.` });
      onOpenChange(false);
    }
  };

  const focusRowInput = (id: string) => {
    requestAnimationFrame(() => bodyRef.current?.querySelector<HTMLInputElement>(`[data-restock-input="${id}"]`)?.focus());
  };
  const addItem = (id: string) => {
    setAdded((a) => (a.includes(id) ? a : [...a, id]));
    setAdding(false);
    focusRowInput(id);
  };

  const mobile = variant === 'mobile';

  const gridBody = (() => {
    if (status === 'loading' || status === 'idle') {
      return (
        <SkeletonRows count={4} label="Loading restock levels">
          {(i) => <TableRowSkeleton key={i} widths={[40, 72]} nameWidth={140} className="px-3" />}
        </SkeletonRows>
      );
    }
    if (status === 'error') {
      return <StockErrorCard title="Couldn't load restock levels" description="Check your connection and try again." onRetry={reload} />;
    }
    if (visible.length === 0) {
      return adding ? null : (
        <div className="flex justify-center">
          <StockEmptyCard
            title="No Central Store items have a restock level yet"
            description="Add an item to start flagging low stock."
            actionLabel="Add an item"
            onAction={() => setAdding(true)}
          />
        </div>
      );
    }
    if (shown.length === 0) {
      return <StockEmptyCard title="No matches" description={`No item with a restock level matches “${search.trim()}”.`} />;
    }
    return (
      <RestockLevelGrid
        variant={variant}
        rows={shown.map(toGridRow)}
        changedIds={changed}
        onRestockLevelChange={(id, value) => {
          setLevel(id, value === '' ? null : value);
          setLastChanged(id);
        }}
      />
    );
  })();

  const ready = status === 'ready';
  const body = (
    <div ref={bodyRef} className="flex flex-col gap-4">
      {saveError ? (
        <FormErrorBanner
          title="Couldn't save restock levels"
          description="The connection dropped before the save finished. Your changes are still here — press Save again."
        />
      ) : null}
      {mobile && ready && visible.length > 0 ? (
        <div className="flex h-[38px] shrink-0 items-center gap-2 rounded-wds-md border border-wds-border-strong bg-wds-surface px-3 transition-[border-color,box-shadow] duration-150 focus-within:border-wds-primary focus-within:shadow-wds-ring">
          <Search className="size-4 shrink-0 text-wds-text-faint" strokeWidth={2} aria-hidden />
          <input
            type="search"
            name="restock-search"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search an item"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search an item"
            className="min-w-0 grow bg-transparent font-wds-sans text-[13px]/4 text-wds-text-ink outline-none placeholder:text-wds-text-faint"
          />
        </div>
      ) : null}
      {gridBody}
      {ready ? <AddItemControl open={adding} onOpenChange={setAdding} options={addable} onPick={addItem} mobile={mobile} /> : null}
      {ready && visible.length > 0 ? <RestockLevelHelperNote variant={variant}>{note}</RestockLevelHelperNote> : null}
    </div>
  );

  const confirm = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Discard your restock level changes?"
      description="Nothing has been saved yet. The levels will stay as they were."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      destructive
      onConfirm={() => {
        setConfirmOpen(false);
        close();
      }}
    />
  );

  const saveLabel = saving ? 'Saving…' : 'Save restock levels';

  if (mobile) {
    if (!open) return null;
    return (
      <>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Restock levels"
          onKeyDown={(e) => {
            if (e.key === 'Escape') requestClose();
          }}
          className="fixed inset-0 z-50 flex flex-col bg-wds-canvas motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-[250ms] motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)]"
        >
          <MobileStatusBar className="bg-wds-sidebar-top" />
          <StockMobileHeader
            title="Restock levels"
            subtitle="Central Store items only — drives the store low-stock signal"
            onBack={requestClose}
            trailingLabel="Done"
            onTrailing={() => (isDirty ? void handleSave() : close())}
          />
          <div className="flex-1 overflow-y-auto overscroll-contain p-4">{body}</div>
          <div className="border-t border-wds-border p-4">
            <Button className="h-11 w-full" onClick={handleSave} disabled={!isDirty || saving} aria-busy={saving}>
              {saveLabel}
            </Button>
          </div>
        </div>
        {confirm}
      </>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        <SheetContent
          className={cn('flex w-[440px] flex-col gap-0 p-0 [&>button:first-of-type]:hidden', STOCK_DRAWER_MOTION)}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            requestClose();
          }}
          onCloseAutoFocus={returnFocus.restore}
          onOpenAutoFocus={(e) => {
            returnFocus.capture();
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('[data-restock-close]')?.focus();
          }}
        >
          <div className="flex shrink-0 flex-col gap-0.5 border-b border-wds-border px-6 pb-4 pt-5">
            <div className="flex items-center justify-between">
              <SheetTitle className="font-wds-sans text-[16px]/5 font-semibold text-wds-text-ink">Restock levels</SheetTitle>
              <SheetPrimitive.Close
                data-restock-close
                onClick={(e) => {
                  e.preventDefault();
                  requestClose();
                }}
                aria-label="Close"
                className="-m-1.5 rounded-wds-sm p-1.5 font-wds-sans text-[16px]/5 text-wds-text-faint outline-none transition-colors hover:text-wds-text-ink focus-visible:shadow-wds-ring"
              >
                <span aria-hidden>×</span>
              </SheetPrimitive.Close>
            </div>
            <SheetDescription className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
              Central Store items only. Store restock level drives the store low-stock signal.
            </SheetDescription>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">{body}</div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-wds-border px-6 py-4">
            <Button variant="secondary" onClick={requestClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isDirty || saving} aria-busy={saving}>
              {saveLabel}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      {confirm}
    </>
  );
}

/**
 * "+ Add an item" — Paper's dashed row (`18ZV-0`). Opens an inline search
 * over the items that don't have a level yet (already loaded — no request);
 * picking one adds its row and focuses its input.
 */
function AddItemControl({
  open,
  onOpenChange,
  options,
  onPick,
  mobile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: RestockLevelRow[];
  onPick: (id: string) => void;
  mobile: boolean;
}) {
  const [q, setQ] = React.useState('');
  const [active, setActive] = React.useState(0);
  const listId = React.useId();
  const query = q.trim().toLowerCase();
  const matches = (query ? options.filter((o) => o.itemName.toLowerCase().includes(query)) : options).slice(0, 6);

  React.useEffect(() => {
    if (!open) setQ('');
    setActive(0);
  }, [open, query]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        disabled={options.length === 0}
        className={cn(
          'flex h-8 shrink-0 items-center rounded-wds-sm border border-dashed border-wds-border-strong px-2.5 text-left font-wds-sans text-[13px]/4 outline-none transition-colors duration-150 hover:border-wds-primary hover:text-wds-primary focus-visible:shadow-wds-ring disabled:cursor-not-allowed disabled:opacity-60',
          mobile ? 'border-none px-0 text-wds-primary' : 'text-wds-text-faint',
        )}
      >
        + Add an item
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
      <input
        autoFocus
        type="search"
        name="restock-add-item"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-activedescendant={matches[active] ? `${listId}-${matches[active].inventoryItemId}` : undefined}
        aria-label="Add an item"
        placeholder="Search an item to add…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node | null)) onOpenChange(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && matches[active]) {
            e.preventDefault();
            onPick(matches[active].inventoryItemId);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onOpenChange(false);
          }
        }}
        className="h-8 rounded-wds-sm border border-wds-primary bg-wds-surface px-2.5 font-wds-sans text-[13px]/4 text-wds-text-ink outline-none shadow-wds-ring placeholder:text-wds-text-faint"
      />
      <ul id={listId} role="listbox" aria-label="Items without a restock level" className="flex flex-col overflow-hidden rounded-wds-sm border border-wds-border bg-wds-surface">
        {matches.length === 0 ? (
          <li className="px-2.5 py-2 font-wds-sans text-wds-caption text-wds-text-copy-muted">No item matches “{q.trim()}”.</li>
        ) : (
          matches.map((o, i) => (
            <li
              key={o.inventoryItemId}
              id={`${listId}-${o.inventoryItemId}`}
              role="option"
              aria-selected={i === active}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(o.inventoryItemId)}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-3 px-2.5 py-2 font-wds-sans text-[13px]/4 text-wds-text-ink',
                i === active && 'bg-wds-neutral-100',
              )}
            >
              <span className="truncate">{o.itemName}</span>
              <span className="shrink-0 font-wds-mono text-wds-field-label text-wds-text-faint">
                {formatNumber(o.onHandQty)} {o.usageUnit} on hand
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
