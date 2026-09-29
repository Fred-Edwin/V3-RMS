'use client';

import { Suspense } from 'react';

import { StockLedgerScreen } from '@/features/inventory';

// useSearchParams() (range / type / page / highlight live in the URL) needs a Suspense boundary.
export default function StockLedgerPage({ params }: { params: { itemId: string } }) {
  return (
    <Suspense fallback={null}>
      <StockLedgerScreen itemId={params.itemId} scope="store" />
    </Suspense>
  );
}
