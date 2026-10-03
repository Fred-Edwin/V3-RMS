'use client';

import { Suspense } from 'react';

import { DayHistoryScreen } from '@/features/inventory/branch-day';

// useSearchParams() (the date range) needs a Suspense boundary — see ../page.tsx.
export default function BranchDayHistoryPage() {
  return (
    <Suspense fallback={null}>
      <DayHistoryScreen />
    </Suspense>
  );
}
