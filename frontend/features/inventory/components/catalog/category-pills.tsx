import * as React from 'react';

import { cn } from '@/lib/cn';

export interface CategoryPill {
  id: string;
  name: string;
  /** Live items in the category. */
  count: number;
}

const pillBase =
  'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-wds-sm border px-3.5 font-wds-sans text-[13px] leading-4 transition-[background-color,border-color,color,transform] duration-150 focus-visible:outline-none focus-visible:shadow-wds-ring motion-safe:active:scale-[0.97]';

/**
 * A row of category pills that scrolls sideways, so a phone gets to a group of
 * items in one tap instead of scrolling the whole list. "All" clears it; a
 * tapped pill is filled, and tapping it again goes back to All.
 */
export function CategoryPills({
  categories,
  selectedId,
  onSelect,
  className,
}: {
  categories: CategoryPill[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}) {
  const selectedRef = React.useRef<HTMLButtonElement>(null);

  // A pill picked by tap stays in view; one set from elsewhere (Clear filters) scrolls into view.
  React.useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  const pill = (active: boolean) =>
    cn(pillBase, active ? 'border-wds-text-ink bg-wds-text-ink font-medium text-white' : 'border-wds-border-strong bg-white text-wds-text-ink');

  return (
    <div
      role="group"
      aria-label="Category"
      className={cn('-mx-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}
    >
      <button type="button" aria-pressed={selectedId === null} onClick={() => onSelect(null)} className={pill(selectedId === null)}>
        All
      </button>
      {categories.map((category) => {
        const active = selectedId === category.id;
        return (
          <button
            key={category.id}
            ref={active ? selectedRef : undefined}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? null : category.id)}
            className={pill(active)}
          >
            {category.name}
            <span className={cn('font-wds-mono text-[11px] leading-[14px]', active ? 'text-[#B5AEA5]' : 'text-wds-text-secondary')}>{category.count}</span>
          </button>
        );
      })}
    </div>
  );
}
