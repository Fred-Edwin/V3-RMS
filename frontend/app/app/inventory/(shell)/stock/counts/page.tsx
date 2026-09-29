'use client';

import { Suspense } from 'react';

import { StockCountsScreen } from '@/features/inventory';

// useSearchParams() (the selected count lives in the URL) needs a Suspense boundary.
export default function StockCountsPage() {
  return (
    <Suspense fallback={null}>
      <StockCountsScreen />
    </Suspense>
  );
}
