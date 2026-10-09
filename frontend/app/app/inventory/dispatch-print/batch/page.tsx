'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { DeliveryNoteBatchPrintScreen } from '@/features/inventory';

/** Standalone print route (no sidebar, no top bar): the notes of the dispatches just sent, store copy then branch copy for each. */
function Notes() {
  const ids = (useSearchParams().get('ids') ?? '').split(',').filter(Boolean);
  return <DeliveryNoteBatchPrintScreen ids={ids} />;
}

export default function DispatchPrintBatchPage() {
  return (
    <Suspense>
      <Notes />
    </Suspense>
  );
}
