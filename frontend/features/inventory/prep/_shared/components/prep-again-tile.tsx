import * as React from 'react';

import { cn } from '@/lib/cn';
import type { PrepAgainResponse } from '../types/prep-contract';

export type PrepAgainTileData = PrepAgainResponse['tiles'][number];

/**
 * PrepAgainTile (Paper `6Q0-0` phone and computer, `1U8C-0` tablet): the item, "Chicken, paste · about 38 portions", and a Prep
 * button that opens the run filled in as last time. `layout="row"` puts the button at the right (phone, computer); `layout="card"`
 * stacks it under the text (tablet's three across).
 */
export function PrepAgainTile({ tile, onPrep, layout = 'row', className }: { tile: PrepAgainTileData; onPrep: (itemId: string) => void; layout?: 'row' | 'card'; className?: string }) {
  const detail = [tile.ingredientsText, tile.expectedText].filter((part): part is string => Boolean(part)).join(' · ');
  const button = (
    <button
      type="button"
      onClick={() => onPrep(tile.itemId)}
      aria-label={`Prep ${tile.name}`}
      className={cn(
        'border border-wds-caramel-300 bg-wds-espresso-50 font-wds-sans text-wds-body-sm text-wds-espresso-700 outline-none transition-colors hover:bg-wds-espresso-100 focus-visible:shadow-wds-ring active:bg-wds-espresso-100',
        layout === 'row' ? 'h-9 shrink-0 px-wds-5' : 'h-9 w-full'
      )}
    >
      Prep
    </button>
  );
  return (
    <div className={cn('border border-wds-border bg-wds-surface p-wds-4', layout === 'row' ? 'flex items-center justify-between gap-wds-3' : 'flex flex-col gap-wds-3', className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-wds-sans text-[16px] font-medium leading-5 text-wds-text-ink">{tile.name}</span>
        {detail ? <span className="truncate font-wds-sans text-wds-caption text-wds-text-copy-muted">{detail}</span> : null}
      </div>
      {button}
    </div>
  );
}
