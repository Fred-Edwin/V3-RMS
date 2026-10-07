'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { FormErrorBanner } from '../../../_shared/components/stock-states';
import { useSortableList } from '../../../_shared/hooks/use-sortable-list';
import { scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { itemsLabel } from '../../_shared/lib/count-format';
import { COUNT_ERROR_COPY, COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import type { StartSection } from '../../_shared/types/counting-contract';

/**
 * Reorder sections for today (Paper step 40, `245F-0`): the same header as Pick a section, six-dot handles, "for today only".
 * Drag a handle, or focus it and press the arrow keys. Done saves this person's order for today (C14); tomorrow the Manager's
 * shelf order is back. Nothing is saved until Done, and a failed save keeps the order on screen.
 */
export function ReorderSheet({ sections, onDone }: { sections: StartSection[]; onDone: () => void }) {
  const [order, setOrder] = React.useState(sections);
  const [saving, setSaving] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const sortable = useSortableList(order, (s) => s.id, (s) => s.name, setOrder);

  const done = async (): Promise<void> => {
    if (saving) return;
    const changed = order.some((s, i) => s.id !== sections[i]?.id);
    if (!changed) {
      onDone();
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      await countingApi.sectionOrderToday(order.map((s) => s.id));
      onDone();
    } catch (err) {
      setFailure(scwErrorMessage(err, COUNT_ERROR_COPY, COUNTING_STATES_COPY.reorderToday.error));
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-1.5 px-4 pb-1 pt-4">
        <h2 className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-muted">Sections · for today only</h2>
        <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-muted">Drag a section to count it earlier. Tomorrow the shelf order is back to the Manager's.</p>
      </div>
      {failure ? <FormErrorBanner className="mx-4 mt-2" title="Could not change the order" description={failure} /> : null}
      <ol className="flex flex-col gap-2 px-4 pt-2">
        {order.map((section, index) => {
          const moving = sortable.draggingId === section.id;
          return (
            <li
              key={section.id}
              ref={sortable.rowRef(section.id)}
              className={cn(
                'flex items-center gap-3 p-3.5 transition-[background-color,border-color] duration-150',
                moving ? 'border-[1.5px] border-wds-selected-edge bg-wds-espresso-50' : 'border border-wds-border bg-wds-surface',
              )}
            >
              <button
                {...sortable.handleProps(section.id, `${section.name}, position ${index + 1} of ${order.length}`)}
                className={cn(
                  '-m-[13px] flex size-11 shrink-0 cursor-grab items-center justify-center outline-none focus-visible:shadow-wds-ring active:cursor-grabbing',
                  moving ? 'text-wds-selected-edge' : 'text-wds-neutral-500',
                )}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="currentColor">
                  {[4, 9, 14].flatMap((y) => [6, 12].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" />))}
                </svg>
              </button>
              <span className="flex min-w-0 grow flex-col gap-[3px]">
                <span className="truncate font-wds-sans text-[17px] font-semibold leading-[22px] text-wds-text-ink">{section.name}</span>
                <span className="truncate font-wds-sans text-[12px] leading-4 text-wds-text-muted">
                  {itemsLabel(section.itemCount)} · {section.lastCountedText.toLowerCase()}
                  {moving ? ' · moving' : ''}
                </span>
              </span>
              <span className={cn('font-wds-mono text-[12px] leading-4', moving ? 'text-wds-selected-edge' : 'text-wds-text-faint')} aria-hidden="true">
                {index + 1}
              </span>
            </li>
          );
        })}
      </ol>
      <div role="status" aria-live="polite" className="sr-only">
        {sortable.announcement}
      </div>
      <div className="grow" />
      <div className="flex shrink-0 flex-col gap-2 px-4 pb-5 pt-3">
        <button
          type="button"
          onClick={() => void done()}
          disabled={saving}
          className="flex h-12 shrink-0 items-center justify-center bg-wds-selected-edge font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-surface outline-none transition-[filter,transform,box-shadow,opacity] duration-100 focus-visible:shadow-wds-ring enabled:[@media(hover:hover)]:hover:brightness-110 enabled:motion-safe:active:scale-[0.99] disabled:opacity-70"
        >
          {saving ? 'Saving…' : 'Done'}
        </button>
      </div>
    </div>
  );
}
