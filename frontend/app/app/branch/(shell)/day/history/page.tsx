'use client';

import { Suspense } from 'react';

import { BranchDayHistoryScreen } from '@/features/inventory';

// The search, date range, status and page live in the URL, so useSearchParams() needs a Suspense boundary.
export default function BranchDayHistoryPage() {
  return (
    <Suspense fallback={null}>
      <BranchDayHistoryScreen />
    </Suspense>
  );
}
