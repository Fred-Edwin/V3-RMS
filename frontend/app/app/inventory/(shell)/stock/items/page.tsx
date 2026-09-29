'use client';

import { Suspense } from 'react';

import { StockItemsScreen } from '@/features/inventory';

// useSearchParams() (the filters live in the URL) needs a Suspense boundary.
export default function StockItemsPage() {
  return (
    <Suspense fallback={null}>
      <StockItemsScreen />
    </Suspense>
  );
}
