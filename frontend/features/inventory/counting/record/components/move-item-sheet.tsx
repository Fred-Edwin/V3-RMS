'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { BottomSheet } from '../../../_shared/components/bottom-sheet';
import { FormErrorBanner } from '../../../_shared/components/stock-states';
import { PHONE_SECONDARY_BUTTON } from '../../../_shared/lib/phone-styles';
import { scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { COUNT_ERROR_COPY, COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import { useStartOptions } from '../hooks/use-start-options';

/**
 * Move an item to another section (Paper step 41, `247B-0`): a sheet over the count listing the sections, with the item's own
 * section marked "Current section". Picking one moves it at once, is logged, and the Manager sees it in Count setup and can undo
 * it. An item inside this open count keeps its place in the count. Cancel and Escape close it without moving anything.
 */
export function MoveItemSheet({
  item,
  onClose,
  onMoved,
}: {
  item: { itemId: string; name: string; unit: string; sectionName: string | null } | null;
  onClose: () => void;
  onMoved: (message: string) => void;
}) {
  const options = useStartOptions();
  const [movingTo, setMovingTo] = React.useState<string | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (item) setFailure(null);
  }, [item]);

  const move = async (toSectionId: string, toName: string): Promise<void> => {
    if (!item || movingTo) return;
    setMovingTo(toSectionId);
    setFailure(null);
    try {
      await countingApi.moveItem(item.itemId, toSectionId);
      onMoved(`${item.name} moved to ${toName}. The Manager can undo it.`);
      onClose();
    } catch (err) {
      setFailure(scwErrorMessage(err, COUNT_ERROR_COPY, COUNTING_STATES_COPY.moveItem.error));
    } finally {
      setMovingTo(null);
    }
  };

  return (
    <BottomSheet open={item !== null} onOpenChange={(open) => (open ? undefined : onClose())} label="Move an item" scrim={45} dismissible={movingTo === null} className="gap-3.5 border-t border-wds-border-strong px-4 pb-6 pt-5">
      <div className="flex flex-col gap-[3px]">
        <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-muted">Move an item</span>
        <span className="font-wds-sans text-[18px] font-semibold leading-6 text-wds-text-ink">
          {item?.name} · {item?.unit}
        </span>
        <span className="font-wds-sans text-[13px] leading-[19px] text-wds-text-muted">Now in {item?.sectionName ?? 'no section'}. Pick where it belongs.</span>
      </div>
      {failure ? <FormErrorBanner title="Could not move it" description={failure} /> : null}
      <ul className="flex flex-col" aria-busy={movingTo !== null}>
        {options.data?.sections.map((section, i, all) => {
          const current = section.name === item?.sectionName;
          return (
            <li key={section.id} className={cn('border-t border-wds-neutral-100', i === all.length - 1 && 'border-b')}>
              {current ? (
                <div className="flex h-[52px] items-center justify-between">
                  <span className="font-wds-sans text-[15px] leading-5 text-wds-text-faint">{section.name}</span>
                  <span className="font-wds-sans text-[12px] leading-4 text-wds-text-faint">Current section</span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={movingTo !== null}
                  onClick={() => void move(section.id, section.name)}
                  className="flex h-[52px] w-full items-center justify-between outline-none transition-[background-color,opacity] duration-100 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-ring)] enabled:[@media(hover:hover)]:hover:bg-wds-neutral-50 enabled:active:bg-wds-neutral-100 disabled:opacity-60"
                >
                  <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{section.name}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className={cn('text-wds-neutral-500', movingTo === section.id && 'motion-safe:animate-pulse')}>
                    <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="font-wds-sans text-[12px] leading-4 text-wds-text-muted">Moves now. The Manager can undo it.</p>
      <button type="button" onClick={onClose} disabled={movingTo !== null} className={PHONE_SECONDARY_BUTTON}>
        Cancel
      </button>
    </BottomSheet>
  );
}
