'use client';

import * as React from 'react';

import { PrintableRequisition } from '@/features/requisitions/components/printable-requisition';
import { PRINT_HANDOFF_KEY, type PrintableRequisitionProps } from '@/features/requisitions/components/printable-requisition-handoff';

/**
 * Standalone print route for the approval detail — outside `(shell)`, no
 * sidebar/topbar. Reads the draft the approval screen writes to
 * `sessionStorage` right before opening this route (mirrors
 * `purchasing-print/new/page.tsx`'s handoff pattern).
 */
export default function BranchRequisitionPrintPage() {
  const [draft, setDraft] = React.useState<PrintableRequisitionProps | null>(null);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(PRINT_HANDOFF_KEY);
      if (raw) setDraft(JSON.parse(raw) as PrintableRequisitionProps);
    } catch {
      setDraft(null);
    }
  }, []);

  React.useEffect(() => {
    if (draft) {
      const id = window.setTimeout(() => window.print(), 150);
      return () => window.clearTimeout(id);
    }
  }, [draft]);

  if (!draft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
        No requisition to print. Close this tab and try again.
      </div>
    );
  }

  return <PrintableRequisition {...draft} />;
}
