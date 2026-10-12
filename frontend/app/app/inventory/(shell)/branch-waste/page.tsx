'use client';

import { Suspense } from 'react';

import { BranchWasteDeskScreen } from '@/features/inventory';

// Page, search, filters and the date range live in the URL, so useSearchParams() needs a Suspense boundary.
export default function BranchWastePage() {
  return (
    <Suspense fallback={null}>
      <BranchWasteDeskScreen />
    </Suspense>
  );
}
