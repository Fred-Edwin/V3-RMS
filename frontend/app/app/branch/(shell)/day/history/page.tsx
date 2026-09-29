'use client';

import { Suspense } from 'react';

import { DayHistoryScreen } from '@/features/branch-day';

// useSearchParams() (the date range) needs a Suspense boundary — see ../page.tsx.
export default function BranchDayHistoryPage() {
  return (
    <Suspense fallback={null}>
      <DayHistoryScreen />
    </Suspense>
  );
}
