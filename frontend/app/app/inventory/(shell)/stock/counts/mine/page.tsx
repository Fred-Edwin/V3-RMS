'use client';

import { Suspense } from 'react';

import { MyCountsScreen } from '@/features/inventory';

// The date range, status and page live in the URL, so useSearchParams() needs a Suspense boundary.
export default function MyCountsPage() {
  return (
    <Suspense fallback={null}>
      <MyCountsScreen />
    </Suspense>
  );
}
