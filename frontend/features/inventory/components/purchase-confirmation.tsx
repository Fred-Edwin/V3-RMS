'use client';

import * as React from 'react';
import { Check, Printer, Share2 } from 'lucide-react';

import { Button } from '@/components/ui2/button';

/**
 * New Purchase Confirmation — desktop (`XOK-0`) and mobile (`XZM-0`). New
 * composite, 04-components.md's Milestone Two "New Purchase redesign"
 * entry. Shared success content, two different chrome wrappers: desktop
 * keeps the persistent shell around it (topbar breadcrumb visible), mobile
 * is full-bleed light background with NO dark status bar / task header —
 * confirmed by `get_jsx` on `XZM-0`, which has no `MobileStatusBar`
 * equivalent at all, unlike every other mobile screen in this flow.
 */

export interface PurchaseConfirmationProps {
  itemCount: number;
  estTotal: number;
  onPrint: () => void;
  onGoToPurchasing: () => void;
}

function SuccessBadge({ size }: { size: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-wds-success-border bg-wds-success-bg"
      style={{ width: size, height: size }}
    >
      <Check
        className="text-wds-success-fg"
        style={{ width: size * 0.46, height: size * 0.46 }}
        strokeWidth={2}
      />
    </div>
  );
}

export function PurchaseConfirmationDesktop({ itemCount, estTotal, onPrint, onGoToPurchasing }: PurchaseConfirmationProps) {
  return (
    <div className="flex grow flex-col items-center justify-center gap-6 p-6">
      <SuccessBadge size={64} />
      <div className="flex flex-col items-center gap-1.5">
        <span className="font-wds-sans text-[22px] leading-7 font-semibold text-wds-text-ink">Purchase list saved</span>
        <span className="font-wds-sans text-wds-body text-wds-text-copy-muted">
          {itemCount} items &middot; ~KES {estTotal.toLocaleString()} &middot; saved to Inbound as a shopping list
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2.5">
        <Button variant="secondary" onClick={onPrint} className="h-[38px] gap-[7px] px-[18px]">
          <Printer className="size-3.5" strokeWidth={1.75} />
          Print list
        </Button>
        <Button onClick={onGoToPurchasing} className="h-[38px]">
          Go to Purchasing
        </Button>
      </div>
    </div>
  );
}

export function PurchaseConfirmationMobile({ itemCount, estTotal, onPrint, onGoToPurchasing }: PurchaseConfirmationProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-wds-surface">
      <div className="flex grow flex-col items-center justify-center gap-5 p-6">
        <SuccessBadge size={56} />
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-center font-wds-sans text-[19px] leading-6 font-semibold text-wds-text-ink">
            Purchase list saved
          </span>
          <span className="text-center font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            {itemCount} items &middot; ~KES {estTotal.toLocaleString()} &middot; saved to Inbound as a shopping list
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2.5 border-t border-wds-border py-3.5 px-4">
        <Button onClick={onGoToPurchasing} className="h-11 text-wds-section">
          Go to Purchasing
        </Button>
        <Button variant="secondary" onClick={onPrint} className="h-[42px] gap-2">
          <Share2 className="size-3.5" strokeWidth={1.75} />
          Share / print list
        </Button>
      </div>
    </div>
  );
}
