'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { SheetOverlay } from '@/components/ui2/sheet';
import type { RestockChange } from '../hooks/use-restock-levels-page';
import { effectOfLevel, statusFor, type EffectTone } from '../lib/restock-logic';
import { FormErrorBanner } from '../../_shared/components/stock-states';
import { formatNumber } from '../../_shared/components/stock-format';

export const NOTE_MAX = 200;

const headCell = 'font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink';

const TONE_TEXT: Record<EffectTone, string> = {
  warning: 'text-wds-warning-fg',
  error: 'text-wds-error-fg',
  success: 'text-wds-success-fg',
  neutral: 'text-wds-text-secondary',
};
const TONE_DOT: Record<Exclude<EffectTone, 'neutral'>, string> = {
  warning: 'bg-wds-warning-fg',
  error: 'bg-wds-error-fg',
  success: 'bg-wds-success-fg',
};

const qty = (level: number | null, unit: string): string => (level === null ? '—' : `${formatNumber(level)} ${unit}`);

/** "Cooking oil", "A and B", "A, B and 2 more". */
function nameList(names: string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

export interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: RestockChange[];
  saving: boolean;
  /** A failed save: shown at the top of the body; the note and the changes are kept. */
  saveError: string | null;
  onSave: (note: string) => void;
}

/**
 * Review level changes — Paper step 12. Item / Now / After / Effect per changed level, a warning when
 * something turns Low or Out, an optional note (stored as the reason on each change), then Back or Save.
 */
export function ReviewDialog({ open, onOpenChange, changes, saving, saveError, onSave }: ReviewDialogProps) {
  const [note, setNote] = React.useState('');
  React.useEffect(() => {
    if (open) setNote('');
  }, [open]);

  const effects = React.useMemo(
    () =>
      changes.map((change) => ({
        change,
        effect: effectOfLevel(change.row, change.next),
        onHand: Number.parseFloat(change.row.onHandQty),
      })),
    [changes]
  );
  const turning = effects.filter((e) => e.effect.kind === 'BECOMES_LOW' || e.effect.kind === 'BECOMES_OUT').map((e) => e.change.row.itemName);
  const count = changes.length;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (saving ? undefined : onOpenChange(next))}>
      <DialogPrimitive.Portal>
        <SheetOverlay />
        <DialogPrimitive.Content
          aria-describedby="restock-review-description"
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-48px)] w-[600px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col border border-wds-border-strong bg-white shadow-wds-md outline-none',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-200',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-150'
          )}
        >
          <div className="flex shrink-0 flex-col gap-1 border-b border-wds-border px-6 pb-4 pt-[22px]">
            <DialogPrimitive.Title className="font-wds-sans text-[20px] font-semibold leading-[26px] tracking-[-0.01em] text-wds-text-ink">
              Review {count} {count === 1 ? 'change' : 'changes'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description id="restock-review-description" className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
              Saved together. Each one is logged with your name and the time.
            </DialogPrimitive.Description>
          </div>
          <div className="flex min-h-0 flex-col gap-[18px] overflow-y-auto px-6 py-5">
            {saveError ? <FormErrorBanner title="Couldn’t save the changes" description={`${saveError} Nothing was changed. Try again.`} /> : null}
            <div role="table" aria-label="Level changes" className="flex flex-col">
              <div role="row" className="flex h-8 shrink-0 items-center border-b border-wds-text-ink">
                <span role="columnheader" className={cn(headCell, 'min-w-0 grow basis-0')}>
                  ITEM
                </span>
                <span role="columnheader" className={cn(headCell, 'w-[90px] shrink-0 text-right')}>
                  NOW
                </span>
                <span role="columnheader" className={cn(headCell, 'w-[90px] shrink-0 text-right')}>
                  AFTER
                </span>
                <span role="columnheader" className={cn(headCell, 'w-[240px] shrink-0 pl-6')}>
                  EFFECT
                </span>
              </div>
              {effects.map(({ change, effect, onHand }) => {
                const unit = change.row.usageUnit;
                // Cleared levels have no status to name beyond "Level cleared".
                const showOnHand = change.next !== null && statusFor(onHand, change.next) !== 'NO_LEVEL';
                return (
                  <div key={change.row.inventoryItemId} role="row" className="flex h-12 shrink-0 items-center border-b border-wds-neutral-100">
                    <span role="cell" className="min-w-0 grow basis-0 truncate font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">
                      {change.row.itemName}
                    </span>
                    <span role="cell" className="w-[90px] shrink-0 text-right font-wds-mono text-[13px] leading-4 text-wds-text-secondary">
                      {qty(change.before, unit)}
                    </span>
                    <span role="cell" className="w-[90px] shrink-0 text-right font-wds-mono text-[13px] font-semibold leading-4 text-wds-text-ink">
                      {qty(change.next, unit)}
                    </span>
                    <span role="cell" className="flex w-[240px] shrink-0 items-center gap-[7px] whitespace-nowrap pl-6">
                      {effect.tone !== 'neutral' ? <span aria-hidden className={cn('size-1.5 shrink-0 rounded-[3px]', TONE_DOT[effect.tone])} /> : null}
                      <span className={cn('font-wds-sans text-[13px] leading-4', TONE_TEXT[effect.tone])}>
                        {effect.label}
                        {showOnHand ? ` · ${formatNumber(onHand)} ${unit} on hand` : null}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            {turning.length > 0 ? (
              <div role="note" className="flex gap-2.5 border border-wds-warning-border bg-wds-warning-bg px-3.5 py-3">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-[3px] bg-wds-warning-fg" />
                <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
                  {nameList(turning)} will show on Needs restocking right away. Low items are what the Purchasing page suggests for the next order.
                </p>
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <span className="flex items-baseline gap-2">
                <label htmlFor="restock-note" className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink">
                  NOTE
                </label>
                <span className="font-wds-sans text-[12px] leading-4 text-wds-text-faint">optional</span>
              </span>
              <input
                id="restock-note"
                type="text"
                value={note}
                maxLength={NOTE_MAX}
                disabled={saving}
                onChange={(e) => setNote(e.target.value)}
                placeholder="For example: bigger orders from the weekend market"
                className="h-[38px] w-full rounded-wds-sm border border-wds-border-strong bg-white px-3 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink placeholder:text-wds-text-faint focus-visible:outline-none focus-visible:border-wds-selected-edge focus-visible:shadow-[0_0_0_1px_var(--wds-selected-edge)] disabled:opacity-60"
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-wds-border px-6 py-4">
            <Button variant="secondary" className="h-9 !px-[18px] text-[14px] font-normal" disabled={saving} onClick={() => onOpenChange(false)}>
              Back
            </Button>
            <Button className="h-9 !px-[22px] text-[14px]" disabled={saving || count === 0} onClick={() => onSave(note)}>
              {saving ? 'Saving…' : `Save ${count} ${count === 1 ? 'change' : 'changes'}`}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
