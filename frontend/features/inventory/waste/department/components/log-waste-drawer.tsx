'use client';

import * as React from 'react';

/**
 * Motion for the Milestone Six drawers (§4.2 + emil-design-eng): slide in
 * from the right in 250ms on the iOS-style drawer curve, out in 200ms;
 * reduced motion drops the slide (the overlay fade stays).
 *
 * This file used to hold the old Log waste drawer; that drawer and its form are deleted (Block 3), and what stays is the two
 * helpers other drawers still import (the thresholds drawer, `features/inventory/index.ts`).
 */
export const STOCK_DRAWER_MOTION =
  'data-[state=open]:duration-[250ms] data-[state=closed]:duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:data-[state=open]:slide-in-from-right-0 motion-reduce:data-[state=closed]:slide-out-to-right-0';

/**
 * Radix Dialog only returns focus to a `Dialog.Trigger`; these drawers open
 * from ordinary buttons (top bar, band links). `capture` runs in
 * `onOpenAutoFocus` — the moment before Radix moves focus inside, when the
 * opener still has it — and `restore` in `onCloseAutoFocus` (§4.2 "focus
 * returns to the trigger").
 */
export function useReturnFocus() {
  const opener = React.useRef<HTMLElement | null>(null);
  const capture = React.useCallback(() => {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }, []);
  const restore = React.useCallback((e: Event) => {
    if (opener.current?.isConnected) {
      e.preventDefault();
      opener.current.focus();
    }
    opener.current = null;
  }, []);
  return { capture, restore };
}
