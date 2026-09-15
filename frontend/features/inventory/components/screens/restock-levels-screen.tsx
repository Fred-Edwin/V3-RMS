'use client';

import * as React from 'react';

import { Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from '@/components/ui2/sheet';
import { Button } from '@/components/ui2/button';
import { MobileTaskHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { RestockLevelGrid, RestockLevelHelperNote, type RestockLevelRow as GridRow } from '../restock-level-grid';
import { EmptyState, ErrorState, LoadingState } from '../shell-states';
import { useRestockLevels, type RestockLevelsActor } from '../../hooks/use-restock-levels';
import type { RestockLevelRow } from '../../types';

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

/**
 * Restock levels — screens 5 (Central Store, drawer, 440px — a 4th distinct
 * drawer width, `T52-0`) and 6 (department, mobile-only, `TD1-0`). Both are
 * bulk-save: many rows edited locally, one "Save restock levels" button, one
 * `PUT` (plan §5.4 rule — a per-row save would misrepresent the screen).
 */
export function RestockLevelsDrawer({ open, onOpenChange, variant, locationId, actor }: RestockLevelsDrawerProps) {
  const { rows, isDirty, setLevel, save, saving, saveError, status, error, reload } = useRestockLevels(
    locationId,
    actor
  );

  const handleSave = async () => {
    const ok = await save();
    if (ok) onOpenChange(false);
  };

  const gridRows = rows.map(toGridRow);
  const helperNote =
    actor.role === 'STORE_MANAGER'
      ? 'Raising a restock level flags an item low right away if on-hand is below it. Department restock levels are set by each department head, not here.'
      : "Setting your department's restock level flags an item low for your team. This does not change the Central Store's own level.";

  const body = (() => {
    if (status === 'loading' || status === 'idle') return <LoadingState className="mx-auto" />;
    if (status === 'error') {
      return <ErrorState title="Couldn't load restock levels" description={error ?? 'Try again.'} onRetry={reload} className="mx-auto" />;
    }
    if (gridRows.length === 0) {
      return <EmptyState title="Nothing here yet" description="No items to set a restock level for yet." className="mx-auto" />;
    }
    return (
      <div className="flex flex-col gap-4">
        <RestockLevelGrid
          variant={variant}
          rows={gridRows}
          onRestockLevelChange={(id, value) => setLevel(id, value === '' ? null : value)}
        />
        <RestockLevelHelperNote variant={variant}>{helperNote}</RestockLevelHelperNote>
        {saveError ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{saveError}</p> : null}
      </div>
    );
  })();

  if (!open) return null;

  const title = 'Restock levels';
  const description =
    actor.role === 'STORE_MANAGER'
      ? 'Central Store items only. Store restock level drives the store low-stock signal.'
      : "Your department's items only. This restock level drives your team's low-stock signal.";

  if (variant === 'mobile') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-wds-canvas">
        <MobileStatusBar />
        <MobileTaskHeader
          title={title}
          subtitle={description}
          trailingAction="Done"
          onBack={() => onOpenChange(false)}
          onTrailingAction={handleSave}
        />
        <div className="flex-1 overflow-y-auto p-4">{body}</div>
        {isDirty ? (
          <div className="border-t border-wds-border p-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex h-11 w-full items-center justify-center rounded-wds-md bg-wds-gradient-primary font-wds-sans text-wds-body font-medium text-wds-primary-fg disabled:opacity-60"
            >
              Save restock levels
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[440px]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-wds-4 overflow-y-auto px-wds-6 py-wds-5">{body}</div>
        <SheetFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !isDirty}>
            Save restock levels
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
