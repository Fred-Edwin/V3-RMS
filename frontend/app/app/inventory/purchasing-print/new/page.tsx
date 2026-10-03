'use client';

import * as React from 'react';

import { PrintablePurchaseList, type PrintablePurchaseListProps } from '@/features/inventory/purchasing/components/printable-purchase-list';

const PRINT_HANDOFF_KEY = 'inventory:new-purchase:print-draft';

/**
 * Standalone print route for the New Purchase printable list (`XN8-0`).
 * Deliberately outside the `(shell)` route group — no sidebar/topbar
 * chrome, per the brief's requirement that the printable list is a distinct
 * layout, not a styled app screen. Reads the draft the New Purchase screen
 * writes to `sessionStorage` right before opening this route in a new tab;
 * see `new-purchase-screen.tsx`'s `buildPrintDraft`/`handlePrint`.
 */
export default function NewPurchasePrintPage() {
  const [draft, setDraft] = React.useState<PrintablePurchaseListProps | null>(null);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(PRINT_HANDOFF_KEY);
      if (raw) setDraft(JSON.parse(raw) as PrintablePurchaseListProps);
    } catch {
      setDraft(null);
    }
  }, []);

  React.useEffect(() => {
    if (draft) {
      // Give the browser a paint frame before invoking the print dialog.
      const id = window.setTimeout(() => window.print(), 150);
      return () => window.clearTimeout(id);
    }
  }, [draft]);

  if (!draft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
        No purchase list to print. Close this tab and try again from New purchase.
      </div>
    );
  }

  return <PrintablePurchaseList {...draft} />;
}
