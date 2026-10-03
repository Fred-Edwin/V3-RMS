'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';

import { PrintableDeliveryNote } from '@/features/inventory/dispatch/components/printable-delivery-note';
import { useDeliveryNote } from '@/features/inventory/dispatch/hooks/use-delivery-note';

/**
 * Standalone print route for the Delivery Note (`15QW-0`/`15SU-0`) —
 * deliberately outside `(shell)`, no sidebar/topbar. Fetches the dispatch
 * directly by id (not a sessionStorage handoff like requisitions/purchasing
 * — a delivery note has a stable backend id and can be reprinted any time,
 * so a direct fetch is more robust than a one-shot draft).
 */
export default function DispatchPrintPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { note, status } = useDeliveryNote(id);

  React.useEffect(() => {
    if (note) {
      const timeoutId = window.setTimeout(() => window.print(), 150);
      return () => window.clearTimeout(timeoutId);
    }
  }, [note]);

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
        Could not load this delivery note. Close this tab and try again.
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
        Loading…
      </div>
    );
  }

  return <PrintableDeliveryNote note={note} requisitionLabel={`Requisition — ${note.branchName}`} />;
}
