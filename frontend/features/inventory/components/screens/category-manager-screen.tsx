'use client';

import * as React from 'react';

import { Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from '@/components/ui2/sheet';
import { Button } from '@/components/ui2/button';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { MobileTaskHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { CategoryManagerList, type CategoryRow } from '../category-manager-list';
import { EmptyState, ErrorState, LoadingState } from '@/components/app/shell/shell-states';
import { useCategoryManager } from '../../hooks/use-categories';
import type { Category } from '../../types';

function toRow(category: Category): CategoryRow {
  return {
    id: category.id,
    name: category.name,
    itemCount: category.itemCount,
    retired: Boolean(category.retiredAt),
  };
}

export interface CategoryManagerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: 'desktop' | 'mobile';
  /** Fired after any add/rename/retire/restore — lets the opening screen refresh its own category list (e.g. the Item Form's dropdown). */
  onCategoriesChanged?: () => void;
}

/**
 * Manage categories — screen 3. Reference: `SRB-0` (desktop drawer, 420px —
 * distinct from Item Form's 500px, per `CategoryManagerList`'s own Status
 * note) / `TLV-0` (mobile full-screen). Renaming a category updates every
 * item by reference; retiring keeps the label off new pickers without
 * touching existing items' category reference (plan §5.3).
 */
export function CategoryManagerDrawer({ open, onOpenChange, variant, onCategoriesChanged }: CategoryManagerDrawerProps) {
  const { categories, status, error, actionError, addCategory, renameCategory, retire, restore, reload } =
    useCategoryManager(onCategoriesChanged);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState('');
  const [retiringCategory, setRetiringCategory] = React.useState<CategoryRow | null>(null);

  const rows = categories.map(toRow);

  const body = (() => {
    if (status === 'loading' || status === 'idle') return <LoadingState className="mx-auto" />;
    if (status === 'error') {
      return <ErrorState title="Couldn't load categories" description={error ?? 'Try again.'} onRetry={reload} className="mx-auto" />;
    }
    if (rows.length === 0) {
      return <EmptyState title="Nothing here yet" description="Add your first category below." className="mx-auto" />;
    }
    return (
      <div className="flex flex-col gap-2">
        {renamingId ? (
          <div className="flex items-center gap-2 rounded-wds-sm border border-wds-primary p-2">
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && renameValue.trim()) {
                  await renameCategory(renamingId, renameValue.trim());
                  setRenamingId(null);
                }
                if (e.key === 'Escape') setRenamingId(null);
              }}
              className="flex-1 border-none font-wds-sans text-wds-body-sm text-wds-text-ink outline-none"
            />
            <button
              type="button"
              className="font-wds-sans text-wds-caption text-wds-primary"
              onClick={async () => {
                if (renameValue.trim()) await renameCategory(renamingId, renameValue.trim());
                setRenamingId(null);
              }}
            >
              Save
            </button>
          </div>
        ) : null}
        <CategoryManagerList
          variant={variant}
          categories={rows}
          onAddCategory={addCategory}
          onRename={(category) => {
            setRenamingId(category.id);
            setRenameValue(category.name);
          }}
          onRestore={(category) => restore(category.id)}
          onRetire={(category) => setRetiringCategory(category)}
        />
        {actionError ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{actionError}</p> : null}
      </div>
    );
  })();

  const retireDialog = (
    <ConfirmDialog
      open={retiringCategory !== null}
      onOpenChange={(next) => !next && setRetiringCategory(null)}
      title="Archive this category?"
      description={
        retiringCategory
          ? `"${retiringCategory.name}" will stop being offered when creating or editing items. Items already using it keep the reference — you can unarchive this category later.`
          : ''
      }
      confirmLabel="Archive category"
      onConfirm={async () => {
        if (!retiringCategory) return;
        await retire(retiringCategory.id);
        setRetiringCategory(null);
      }}
    />
  );

  if (!open) return null;

  if (variant === 'mobile') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-wds-canvas">
        <MobileStatusBar />
        <MobileTaskHeader
          title="Categories"
          subtitle="Renaming updates every item. Archiving hides the label."
          trailingAction="Done"
          onBack={() => onOpenChange(false)}
          onTrailingAction={() => onOpenChange(false)}
        />
        <div className="flex-1 overflow-y-auto p-4">{body}</div>
        {retireDialog}
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px]">
        <SheetHeader>
          <SheetTitle>Categories</SheetTitle>
          <SheetDescription>
            Your own labels for organising the catalog. Renaming updates every item; archiving hides the label but
            keeps history.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-wds-6 py-wds-5">{body}</div>
        <SheetFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </SheetFooter>
      </SheetContent>
      {retireDialog}
    </Sheet>
  );
}
