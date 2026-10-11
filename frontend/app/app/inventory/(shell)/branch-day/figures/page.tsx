'use client';

import { Suspense } from 'react';

import { BranchDayFiguresScreen } from '@/features/inventory';

// The day, the department and the branch live in the URL, so useSearchParams() needs a Suspense boundary.
export default function BranchDayHubFiguresPage() {
  return (
    <Suspense fallback={null}>
      <BranchDayFiguresScreen />
    </Suspense>
  );
}
