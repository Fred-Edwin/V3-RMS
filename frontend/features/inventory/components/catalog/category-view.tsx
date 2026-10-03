'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import type { Category } from '../../types';
import { useCategoryManager } from '../../hooks/use-categories';
import { StockEmptyCard, StockErrorCard } from '../stock/stock-states';
import { Skeleton } from '@/components/ui2/skeleton';
import { DrawerError, DrawerFrame, PrimaryFooterButton, fieldClass } from './drawer-parts';
import { Button } from '@/components/ui2/button';

export interface CategoryViewProps {
  /** Live items in all, so "N items have no category yet" can be worked out. */
  totalItems: number | null;
  onDone: () => void;
  /** Fired after any change, so the catalog behind refreshes its Category filter. */
  onChanged: () => void;
}

function RowActions({ children }: { children: React.ReactNode }) {
  return <span className="flex w-[130px] shrink-0 justify-end gap-3.5">{children}</span>;
}

const linkButton =
  'rounded-wds-sm font-wds-sans text-[13px] leading-4 transition-colors focus-visible:outline-none focus-visible:shadow-wds-ring disabled:opacity-60';

/**
 * Manage categories (Paper step 10): add, rename inline, retire and restore.
 * One list for items and suppliers; renaming changes it everywhere, retiring
 * only stops it being offered.
 */
export function CategoryView({ totalItems, onDone, onChanged }: CategoryViewProps) {
  const { categories, status, error, actionError, addCategory, renameCategory, retire, restore, reload } = useCategoryManager(onChanged);
  const [newName, setNewName] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState('');

  const live = categories.filter((c) => !c.retiredAt);
  const retired = categories.filter((c) => c.retiredAt);
  const categorised = categories.reduce((sum, c) => sum + c.itemCount, 0);
  const uncategorised = totalItems === null ? null : Math.max(0, totalItems - categorised);

  const submitAdd = async () => {
    const name = newName.trim();
    if (!name || adding) return;
    setAdding(true);
    await addCategory(name);
    setNewName('');
    setAdding(false);
  };

  const submitRename = async (category: Category) => {
    const name = renameValue.trim();
    setRenamingId(null);
    if (name && name !== category.name) await renameCategory(category.id, name);
  };

  let body: React.ReactNode;
  if (status === 'loading' || status === 'idle') {
    body = (
      <div role="status" aria-live="polite" className="flex flex-col">
        <span className="sr-only">Loading categories</span>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex h-[46px] items-center gap-4 border-b border-wds-neutral-100" aria-hidden>
            <Skeleton className="h-3 w-[40%]" />
            <span className="grow" />
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
    );
  } else if (status === 'error') {
    body = <StockErrorCard title="Couldn’t load categories" description={error ?? 'Check your connection and try again.'} onRetry={() => void reload()} />;
  } else if (live.length === 0 && retired.length === 0) {
    body = <StockEmptyCard title="No categories yet" description="Add the first one above. Items and suppliers share this list." />;
  } else {
    body = (
      <>
        <div className="flex flex-col">
          <div className="flex h-8 items-center border-b border-wds-text-ink font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink">
            <span className="grow">CATEGORY</span>
            <span className="w-[70px] shrink-0 text-right">ITEMS</span>
            <span className="w-[130px] shrink-0" />
          </div>
          {live.map((category) =>
            renamingId === category.id ? (
              <div key={category.id} className="-mx-6 flex h-[46px] items-center border-b border-wds-neutral-100 bg-wds-espresso-50 px-6">
                <input
                  autoFocus
                  aria-label={`Rename ${category.name}`}
                  name="renameCategory"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submitRename(category);
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setRenamingId(null);
                    }
                  }}
                  className={cn(fieldClass, 'h-8 grow border-[1.5px] border-wds-selected-edge px-2.5')}
                />
                <span className="w-[70px] shrink-0 text-right font-wds-mono text-[13px] leading-4 text-wds-text-ink">{category.itemCount}</span>
                <RowActions>
                  <button type="button" onClick={() => void submitRename(category)} className={cn(linkButton, 'font-semibold text-wds-espresso-700')}>
                    Save
                  </button>
                  <button type="button" onClick={() => setRenamingId(null)} className={cn(linkButton, 'text-wds-text-secondary hover:text-wds-text-ink')}>
                    Cancel
                  </button>
                </RowActions>
              </div>
            ) : (
              <div key={category.id} className="flex h-[46px] items-center border-b border-wds-neutral-100">
                <span className="grow truncate font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{category.name}</span>
                <span className="w-[70px] shrink-0 text-right font-wds-mono text-[13px] leading-4 text-wds-text-ink">{category.itemCount}</span>
                <RowActions>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(category.id);
                      setRenameValue(category.name);
                    }}
                    className={cn(linkButton, 'text-wds-espresso-700 hover:underline')}
                  >
                    Rename
                  </button>
                  <button type="button" onClick={() => void retire(category.id)} className={cn(linkButton, 'text-wds-text-secondary hover:text-wds-text-ink')}>
                    Retire
                  </button>
                </RowActions>
              </div>
            )
          )}
        </div>
        {uncategorised !== null && uncategorised > 0 ? (
          <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            {uncategorised} {uncategorised === 1 ? 'item has' : 'items have'} no category yet.
          </p>
        ) : null}
        {retired.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink">RETIRED</span>
            <div className="flex flex-col">
              {retired.map((category, i) => (
                <div key={category.id} className={cn('flex h-10 items-center justify-between', i === 0 ? 'border-t border-wds-text-ink' : 'border-t border-wds-neutral-100')}>
                  <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-muted">
                    {category.name} · {category.itemCount} {category.itemCount === 1 ? 'item' : 'items'}
                  </span>
                  <button type="button" onClick={() => void restore(category.id)} className={cn(linkButton, 'text-wds-espresso-700 hover:underline')}>
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <DrawerFrame
      title="Manage categories"
      subtitle={<span className="max-w-[360px] font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">One list for items and suppliers. Renaming changes it everywhere. Retiring only stops it being offered.</span>}
      footer={
        <div className="flex w-full justify-end">
          <PrimaryFooterButton onClick={onDone}>Done</PrimaryFooterButton>
        </div>
      }
    >
      {actionError ? <DrawerError>{actionError}</DrawerError> : null}
      <div className="flex gap-2">
        <input
          aria-label="New category name"
          name="newCategory"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submitAdd();
          }}
          placeholder="New category name"
          autoComplete="off"
          className={cn(fieldClass, 'grow')}
        />
        <Button variant="secondary" className="h-[38px] px-4 text-[14px]" onClick={() => void submitAdd()} disabled={adding || newName.trim() === ''}>
          Add
        </Button>
      </div>
      {body}
    </DrawerFrame>
  );
}
