'use client';

import { Suspense } from 'react';

import { WasteScreen } from '@/features/inventory';

// The period, page and `?drawer=log` live in the URL, so useSearchParams() needs a Suspense boundary.
export default function StockWastePage() {
  return (
    <Suspense fallback={null}>
      <WasteScreen />
    </Suspense>
  );
}
