'use client';

import { Suspense } from 'react';

import { BranchDayFiguresScreen } from '@/features/inventory';

// The day and the department live in the URL, so useSearchParams() needs a Suspense boundary.
export default function BranchDayFiguresPage() {
  return (
    <Suspense fallback={null}>
      <BranchDayFiguresScreen />
    </Suspense>
  );
}
