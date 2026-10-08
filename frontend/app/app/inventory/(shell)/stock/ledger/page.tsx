'use client';

import { Suspense } from 'react';

import { StockLedgerScreen } from '@/features/inventory';

// The dates, filters and page live in the URL, so useSearchParams() needs a Suspense boundary.
export default function StockLedgerPage() {
  return (
    <Suspense fallback={null}>
      <StockLedgerScreen />
    </Suspense>
  );
}
