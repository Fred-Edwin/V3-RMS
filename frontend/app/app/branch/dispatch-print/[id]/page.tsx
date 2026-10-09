'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

import { DeliveryNotePrintScreen } from '@/features/inventory';

/** Standalone print route (no sidebar, no top bar): the delivery note, Paper D17 (store copy) and D17b (branch copy). */
function Note() {
  const { id } = useParams<{ id: string }>();
  const copy = useSearchParams().get('copy') === 'branch' ? 'branch' : 'store';
  return <DeliveryNotePrintScreen dispatchId={id} copy={copy} />;
}

export default function DispatchPrintPage() {
  return (
    <Suspense>
      <Note />
    </Suspense>
  );
}
