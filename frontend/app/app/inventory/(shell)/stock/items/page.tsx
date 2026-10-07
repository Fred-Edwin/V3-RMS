'use client';

import { Suspense } from 'react';

import { StockItemsScreen } from '@/features/inventory';

// The filters live in the URL, so useSearchParams() needs a Suspense boundary.
export default function StockItemsPage() {
  return (
    <Suspense fallback={null}>
      <StockItemsScreen />
    </Suspense>
  );
}
