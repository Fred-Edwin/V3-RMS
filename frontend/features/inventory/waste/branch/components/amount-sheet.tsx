'use client';

import * as React from 'react';

import { Keypad } from '@/components/ui2/keypad';
import { cn } from '@/lib/cn';
import { BottomSheet, SheetGrabber } from '../../../_shared/components/bottom-sheet';
import { appendDigit } from '../../../counting/_shared/lib/count-format';
import { BRANCH_WASTE_STATES_COPY } from '../../_shared/lib/branch-waste-copy';
import { WASTE_REASONS, WASTE_REASON_TEXT, type WasteItemOption, type WasteReason } from '../../_shared/types/waste-contract';
import { quantityIsUnreadable, quantityIsValid } from '../lib/branch-waste-format';
import { hitArea, radioGroupKeyDown, radioTabIndex, SectionLabel } from './parts';

export interface AmountSheetTarget {
  item: WasteItemOption;
  /** Typed so far ("" when new). */
  quantity: string;
  /** Null until the person picks one: the reason is required (G3). */
  reason: WasteReason | null;
  /** True when the item is already on the Added list, so the sheet offers Remove (G5). */
  editing: boolean;
}

/**
 * How much, and why (Paper W2): the item and its unit, a 120 × 52 quantity box fed by the number pad, four reason chips (one, radio
 * behaviour), and the Add key. Add waits for a quantity above zero and a reason (G3). Opens with focus on the quantity box; digits,
 * "." and Backspace on a hardware keyboard write into it too. When the item is already on the list the sheet shows "Remove" (G5).
 */
export function AmountSheet({ target, onChange, onClose, onAdd, onRemove }: { target: AmountSheetTarget | null; onChange: (t: AmountSheetTarget) => void; onClose: () => void; onAdd: (t: AmountSheetTarget & { reason: WasteReason }) => void; onRemove: (itemId: string) => void }) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const unreadable = target ? quantityIsUnreadable(target.quantity) : false;
  const canAdd = target !== null && target.reason !== null && quantityIsValid(target.quantity);

  const add = (): void => {
    if (target && target.reason !== null && quantityIsValid(target.quantity)) onAdd({ ...target, reason: target.reason });
  };
  const onBoxKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!target) return;
    if (/^[0-9.]$/.test(event.key)) {
      event.preventDefault();
      onChange({ ...target, quantity: appendDigit(target.quantity, event.key) });
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      onChange({ ...target, quantity: target.quantity.slice(0, -1) });
    } else if (event.key === 'Enter' && canAdd) {
      event.preventDefault();
      add();
    }
  };

  return (
    <BottomSheet open={target !== null} onOpenChange={(open) => (open ? undefined : onClose())} label="How much, and why" scrim={52} initialFocusRef={boxRef} className="gap-[14px] px-4 pb-5 pt-2.5">
      <SheetGrabber />
      {target ? (
        <>
          <div className="flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-wds-sans text-[20px] font-semibold leading-[26px] text-wds-text-ink">{target.item.name}</span>
              <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{target.item.unit}</span>
            </div>
            <div
              ref={boxRef}
              tabIndex={0}
              role="group"
              aria-label={`Quantity in ${target.item.unit}: ${target.quantity === '' ? 'nothing typed yet' : target.quantity}`}
              aria-describedby={unreadable ? 'bw-qty-error' : undefined}
              onKeyDown={onBoxKeyDown}
              className="flex h-[52px] w-[120px] shrink-0 items-center justify-end gap-0.5 border-[1.5px] border-wds-selected-edge px-3 outline-none focus-visible:shadow-wds-ring"
            >
              <span className={cn('font-wds-mono text-[26px] leading-8', target.quantity === '' ? 'text-wds-neutral-400' : 'text-wds-text-ink')} aria-live="polite">
                {target.quantity === '' ? '0' : target.quantity}
              </span>
              <span className="h-7 w-0.5 shrink-0 bg-wds-selected-edge motion-safe:animate-[scw-caret_1.1s_steps(1)_infinite]" aria-hidden />
            </div>
          </div>
          {unreadable ? (
            <p id="bw-qty-error" role="alert" className="-mt-2 text-right font-wds-sans text-[12px] leading-4 text-wds-error-fg">
              {BRANCH_WASTE_STATES_COPY.amount.error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <SectionLabel>Why?</SectionLabel>
            <div role="radiogroup" aria-label="Why" onKeyDown={(e) => radioGroupKeyDown(e, WASTE_REASONS, target.reason, (reason) => onChange({ ...target, reason }))} className="flex flex-wrap gap-2">
              {WASTE_REASONS.map((r, i) => {
                const chosen = target.reason === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    tabIndex={radioTabIndex(i, chosen, target.reason !== null)}
                    onClick={() => onChange({ ...target, reason: r })}
                    className={cn(
                      hitArea(38),
                      'border px-3.5 py-[9px] font-wds-sans text-[14px] leading-[18px] outline-none transition-colors duration-100 focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]',
                      chosen ? 'border-wds-text-ink bg-wds-text-ink font-semibold text-white' : 'border-wds-border-strong bg-wds-surface text-wds-text-ink [@media(hover:hover)]:hover:bg-wds-neutral-50',
                    )}
                  >
                    {WASTE_REASON_TEXT[r]}
                  </button>
                );
              })}
            </div>
          </div>
          <Keypad
            look="paper"
            onDigit={(d) => onChange({ ...target, quantity: appendDigit(target.quantity, d) })}
            onBackspace={() => onChange({ ...target, quantity: target.quantity.slice(0, -1) })}
            action={{ label: 'Add', tone: 'primary', disabled: !canAdd, disabledReason: target.reason === null ? 'Pick a reason first' : 'Type how much first', onPress: add }}
          />
          {target.editing ? (
            <button
              type="button"
              onClick={() => onRemove(target.item.itemId)}
              className="-my-1 self-center px-3 py-3.5 font-wds-sans text-[12px] font-medium leading-4 text-wds-selected-edge underline-offset-4 outline-none transition-[opacity,transform] duration-100 focus-visible:shadow-wds-ring motion-safe:active:scale-[0.97] active:opacity-70 [@media(hover:hover)]:hover:underline"
            >
              Remove {target.item.name}
            </button>
          ) : null}
        </>
      ) : null}
    </BottomSheet>
  );
}
