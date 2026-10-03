'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { Button } from '@/components/ui2/button';
import { SheetOverlay } from '@/components/ui2/sheet';
import { PhoneErrorNote, PhonePrimaryButton } from '../../../_shared/components/phone-parts';
import { formatNumber } from '../../../_shared/components/stock-format';
import { changeEffect, statusFor, levelNumber } from '../../lib/restock-logic';
import { changeCountLabel, reviewSubline } from '../../lib/department-levels';
import type { RestockLevelRow } from '../../../types';

export interface DepartmentChange {
  row: RestockLevelRow;
  saved: string | null;
  next: string | null;
}

const headCell = 'font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-ink';

export interface DepartmentReviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: DepartmentChange[];
  saving: boolean;
  /** A failed save sits at the top of the sheet; the changes stay. */
  saveError: string | null;
  onSave: () => void;
}

/** "Check your changes" — Paper step 28. Saved right away; Back keeps the steps, Save writes them. */
export function DepartmentReviewSheet({ open, onOpenChange, changes, saving, saveError, onSave }: DepartmentReviewSheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (saving ? undefined : onOpenChange(next))}>
      <DialogPrimitive.Portal>
        <SheetOverlay />
        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-[430px] flex-col bg-wds-surface outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-200 data-[state=open]:duration-300"
        >
          <div className="flex justify-center pb-1 pt-2.5">
            <span className="h-1 w-10 rounded-[2px] bg-wds-border-strong" />
          </div>
          <div className="flex flex-col gap-1 px-5 pb-3.5 pt-2.5">
            <DialogPrimitive.Title className="font-wds-sans text-[20px] font-semibold leading-6 tracking-tight text-wds-text-ink">
              Check your changes
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="font-wds-sans text-[13px] leading-[18px] text-wds-text-copy-muted">
              Saved right away. The Store Manager can see every change.
            </DialogPrimitive.Description>
          </div>
          <div className="flex min-h-0 flex-col overflow-y-auto px-5">
            {saveError ? <PhoneErrorNote>{saveError}</PhoneErrorNote> : null}
            <div className="flex h-[30px] shrink-0 items-center border-b border-wds-text-ink">
              <span className={`grow ${headCell}`}>Item</span>
              <span className={headCell}>Level</span>
            </div>
            <ul>
              {changes.map(({ row, saved, next }) => {
                const effect = changeEffect(row.status, statusFor(Number.parseFloat(row.onHandQty), levelNumber(next)));
                return (
                  <li key={row.inventoryItemId} className="flex items-center justify-between gap-3 border-b border-wds-neutral-100 py-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-wds-sans text-[15px] font-medium leading-[18px] text-wds-text-ink">{row.itemName}</span>
                      <span className="font-wds-sans text-[12px] leading-4 text-wds-text-copy-muted">{reviewSubline(effect.kind, row.onHandQty, row.usageUnit)}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-wds-mono text-[13px] leading-4 text-wds-text-faint">{saved === null ? 'none' : formatNumber(saved)}</span>
                      <span className="font-wds-sans text-[13px] leading-4 text-wds-text-faint">→</span>
                      <span className="font-wds-mono text-[15px] font-semibold leading-[18px] text-wds-text-ink">
                        {next === null ? 'cleared' : `${formatNumber(next)} ${row.usageUnit}`}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3.5 border border-wds-border bg-wds-neutral-50 px-3.5 py-3 font-wds-sans text-[12px] leading-[17px] text-wds-text-copy-muted">
              Tomorrow&apos;s requisition starts from these levels. You can change them again at any time, and put an old level back in one tap.
            </div>
          </div>
          <div className="flex gap-2.5 px-5 pb-7 pt-4">
            <Button variant="secondary" className="h-[50px] w-[110px] shrink-0 text-[15px]" onClick={() => onOpenChange(false)} disabled={saving}>
              Back
            </Button>
            <PhonePrimaryButton className="h-[50px] grow" onClick={onSave} disabled={saving || changes.length === 0}>
              {saving ? 'Saving…' : `Save ${changeCountLabel(changes.length)}`}
            </PhonePrimaryButton>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
