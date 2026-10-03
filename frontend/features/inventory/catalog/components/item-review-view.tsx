'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import type { ItemChangeReview } from '../../types';
import type { ChangeRow } from '../lib/item-form-model';
import type { ReviewBullet } from '../lib/item-review';
import { DrawerError, DrawerFrame, PrimaryFooterButton, SecondaryFooterButton } from './drawer-parts';

export interface ItemReviewViewProps {
  itemName: string;
  /** "Edit item" or "Retire item" — the small line above the title. */
  action: 'Edit item' | 'Retire item';
  rows: ChangeRow[];
  bullets: ReviewBullet[];
  review: ItemChangeReview;
  confirmLabel: string;
  confirming: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: () => void;
}

/**
 * Review the change (Paper steps 09 and 09b): what is changing now and after,
 * then what happens to stock, receipts and open orders, in plain sentences
 * from the change-review counts. Nothing is saved until Confirm. There is no
 * reason field yet (the item update takes none; owner decision 3 Oct 2026).
 */
export function ItemReviewView({ itemName, action, rows, bullets, confirmLabel, confirming, error, onBack, onConfirm }: ItemReviewViewProps) {
  return (
    <DrawerFrame
      eyebrow={`${action} · ${itemName}`}
      title="Review the change"
      subtitle="Nothing changes until you confirm."
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <SecondaryFooterButton onClick={onBack} disabled={confirming}>
            Back
          </SecondaryFooterButton>
          <PrimaryFooterButton onClick={onConfirm} disabled={confirming}>
            {confirmLabel}
          </PrimaryFooterButton>
        </div>
      }
    >
      {error ? <DrawerError>{error}</DrawerError> : null}
      <div className="flex flex-col">
        <div className="flex h-8 items-center border-b border-wds-text-ink font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink">
          <span className="w-[120px] shrink-0">WHAT</span>
          <span className="grow basis-0">NOW</span>
          <span className="grow basis-0">AFTER</span>
        </div>
        {rows.map((row) => (
          <div key={row.what} className="flex min-h-11 items-center border-b border-wds-neutral-100 py-2">
            <span className="w-[120px] shrink-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{row.what}</span>
            <span className="grow basis-0 font-wds-mono text-[13px] leading-4 text-wds-text-secondary">{row.now}</span>
            <span className="grow basis-0 font-wds-mono text-[13px] font-semibold leading-4 text-wds-text-ink">{row.after}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink">WHAT HAPPENS</span>
        {bullets.map((bullet) => (
          <div key={bullet.text} className="flex gap-2.5">
            <span aria-hidden className={cn('mt-1.5 size-1.5 shrink-0 rounded-[3px]', bullet.tone === 'safe' ? 'bg-wds-success-fg' : 'bg-wds-warning-fg')} />
            <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{bullet.text}</span>
          </div>
        ))}
      </div>
    </DrawerFrame>
  );
}
