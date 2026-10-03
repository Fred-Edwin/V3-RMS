'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';

import { PrintableCountVerification } from '@/features/inventory/counting/components/printable-count-verification';
import { useCountPrint } from '@/features/inventory/counting/hooks/use-counts';

/**
 * Standalone print route for a count verification document (`1AMZ-0` /
 * `1AP7-0`) — outside `(shell)`, no sidebar/topbar; same pattern as
 * `dispatch-print`. Fetched by id so it can be reprinted any time.
 */
export default function CountPrintPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { print, status } = useCountPrint(id || null);

  React.useEffect(() => {
    if (print) {
      const timeoutId = window.setTimeout(() => window.print(), 150);
      return () => window.clearTimeout(timeoutId);
    }
  }, [print]);

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
        Could not load this verification document. Close this tab and try again.
      </div>
    );
  }
  if (!print) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
        Loading…
      </div>
    );
  }
  return <PrintableCountVerification doc={print} />;
}
