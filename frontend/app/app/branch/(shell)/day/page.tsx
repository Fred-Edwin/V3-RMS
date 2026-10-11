'use client';

import { Suspense } from 'react';

import { BranchDayTodayScreen } from '@/features/inventory';

// The branch picker's value lives in the URL, so useSearchParams() needs a Suspense boundary.
export default function BranchDayPage() {
  return (
    <Suspense fallback={null}>
      <BranchDayTodayScreen />
    </Suspense>
  );
}
