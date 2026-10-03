'use client';

import { Suspense } from 'react';

import { TodaysDayScreen } from '@/features/inventory/branch-day';

// useSearchParams() (the selected department) needs a Suspense boundary —
// see the note in ../deliveries/page.tsx.
export default function BranchDayPage() {
  return (
    <Suspense fallback={null}>
      <TodaysDayScreen />
    </Suspense>
  );
}
