'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';

import { PrintableDayDocument, useDayDocument } from '@/features/inventory/branch-day';

/**
 * Standalone print route for the signed day-close document (`19S2-0`) —
 * outside `(shell)`, no sidebar/topbar; same pattern as `count-print` and
 * `dispatch-print`. Fetched by id so it can be reprinted any time.
 */
export default function BranchDayPrintPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { doc, status } = useDayDocument(id || null);

  React.useEffect(() => {
    if (doc) {
      const timeoutId = window.setTimeout(() => window.print(), 150);
      return () => window.clearTimeout(timeoutId);
    }
  }, [doc]);

  if (status === 'error') {
    return <div className="flex min-h-screen items-center justify-center bg-white font-wds-sans text-wds-body-sm text-wds-text-copy-muted">Could not load this document. Close this tab and try again.</div>;
  }
  if (!doc) {
    return <div className="flex min-h-screen items-center justify-center bg-white font-wds-sans text-wds-body-sm text-wds-text-copy-muted">Loading…</div>;
  }
  return <PrintableDayDocument doc={doc} />;
}
