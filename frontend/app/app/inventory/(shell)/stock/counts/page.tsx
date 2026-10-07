'use client';

import { Suspense } from 'react';

import { CountsHomeScreen } from '@/features/inventory';

// The page state (filters, page, search, view) lives in the URL, so useSearchParams() needs a Suspense boundary. Which screen this is
// (the Counts list or Pick a section) is decided inside the feature from what the caller may do, not here.
export default function StockCountsPage() {
  return (
    <Suspense fallback={null}>
      <CountsHomeScreen />
    </Suspense>
  );
}
