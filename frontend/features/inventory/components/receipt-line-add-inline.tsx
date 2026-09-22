'use client';

import * as React from 'react';

import { Combobox } from '@/components/ui2/combobox';
import type { InventoryItem } from '../types';

/**
 * Inline "add item not on the delivery" row for the Receipt Line Grid's
 * footer slot (`addLineSlot`) — replaces the earlier modal
 * (`add-receipt-line-dialog.tsx`, removed). Once prefill from an expected
 * delivery exists, this is a rare exception-case action (the driver brought
 * something unplanned), not the primary way lines get onto a receipt — so it
 * should feel like a small, low-friction addition to the grid, not a modal
 * dialog interrupting the page.
 *
 * Flow: clicking "+ Add item not on the delivery" (rendered by the parent
 * screen when `adding` is false) swaps this row in; it's a bare combobox
 * with no surrounding chrome. Selecting an item calls `onAdd` and the parent
 * resets `adding` back to false, so the link reappears for adding a second
 * unplanned item. Escape or blur-while-empty cancels back to the link.
 */
export interface ReceiptLineAddInlineProps {
  items: InventoryItem[];
  onAdd: (item: InventoryItem) => void;
  onCancel: () => void;
}

export function ReceiptLineAddInline({ items, onAdd, onCancel }: ReceiptLineAddInlineProps) {
  const options = React.useMemo(() => items.map((item) => ({ value: item.id, label: item.name })), [items]);

  const handleSelect = (value: string) => {
    const item = items.find((i) => i.id === value);
    if (item) onAdd(item);
  };

  return (
    <div className="flex h-11 shrink-0 items-center gap-wds-2 px-wds-4">
      <Combobox
        value=""
        onValueChange={handleSelect}
        options={options}
        placeholder="Search items to add…"
        aria-label="Item to add"
        className="h-7 max-w-[320px]"
      />
      <button
        type="button"
        onClick={onCancel}
        className="font-wds-sans text-wds-caption text-wds-text-copy-muted outline-none transition-colors hover:text-wds-text-ink focus-visible:shadow-wds-ring"
      >
        Cancel
      </button>
    </div>
  );
}
