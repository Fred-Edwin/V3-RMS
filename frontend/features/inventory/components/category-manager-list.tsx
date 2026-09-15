import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Category Manager List — Manage categories drawer body (desktop) / mobile
 * full-screen route. Reference: `SRG-0` (desktop, inside the 420px
 * "Manage categories" drawer — narrower than the Item Form's 500px drawer,
 * confirmed via `get_computed_styles` on `SRC-0`, not assumed the same
 * width as every other drawer) / `TX2-0` (mobile, "3m · Manage categories").
 *
 * Retired categories show "Restore" instead of "Rename" and the whole row
 * sits at 55% opacity (`SRH-0`, same convention as the Item Catalog Table's
 * retired-row state) — Paper-verified, not derived.
 */
export interface CategoryRow {
  id: string;
  name: string;
  itemCount: number;
  retired?: boolean;
}

export interface CategoryManagerListProps {
  variant: 'desktop' | 'mobile';
  categories: CategoryRow[];
  onAddCategory?: (name: string) => void;
  onRename?: (category: CategoryRow) => void;
  onRestore?: (category: CategoryRow) => void;
  className?: string;
}

export function CategoryManagerList({
  variant,
  categories,
  onAddCategory,
  onRename,
  onRestore,
  className,
}: CategoryManagerListProps) {
  const isMobile = variant === 'mobile';
  const [newCategoryName, setNewCategoryName] = React.useState('');

  const addInputClass = isMobile ? 'h-[44px] rounded-wds-md px-wds-3' : 'h-8 rounded-wds-sm px-wds-2.5';
  const rowPaddingClass = isMobile ? 'py-wds-3.5 px-wds-3' : 'h-11 px-wds-2';
  const linkToneClass = isMobile ? 'text-wds-primary' : 'text-wds-text-copy-muted';

  return (
    <div className={cn('flex flex-col gap-wds-2', className)}>
      <input
        value={newCategoryName}
        onChange={(e) => setNewCategoryName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && newCategoryName.trim()) {
            onAddCategory?.(newCategoryName.trim());
            setNewCategoryName('');
          }
        }}
        placeholder="+ Add a category"
        className={cn(
          'flex items-center border border-dashed border-wds-border-strong bg-wds-surface font-wds-sans text-wds-body-sm text-wds-text-ink placeholder:text-wds-text-copy-muted focus-visible:outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring',
          addInputClass
        )}
      />
      <div className="flex flex-col">
        {categories.map((category) => (
          <div
            key={category.id}
            className={cn(
              'flex items-center justify-between border-b border-wds-border last:border-b-0',
              rowPaddingClass,
              category.retired && 'opacity-55'
            )}
          >
            <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{category.name}</span>
            <div className={cn('flex items-center', isMobile ? 'gap-wds-3.5' : 'gap-wds-3')}>
              <span className="w-16 shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-copy-muted">
                {category.itemCount} items
              </span>
              <button
                type="button"
                onClick={() =>
                  category.retired ? onRestore?.(category) : onRename?.(category)
                }
                className={cn(
                  'w-14 shrink-0 text-right font-wds-sans text-wds-caption',
                  category.retired ? 'text-wds-primary' : linkToneClass
                )}
              >
                {category.retired ? 'Restore' : 'Rename'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
