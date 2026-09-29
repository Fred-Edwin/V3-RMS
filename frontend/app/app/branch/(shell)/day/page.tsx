'use client';

import { Suspense } from 'react';

import { TodaysDayScreen } from '@/features/branch-day';

// useSearchParams() (the selected department) needs a Suspense boundary —
// see the note in ../deliveries/page.tsx.
export default function BranchDayPage() {
  return (
    <Suspense fallback={null}>
      <TodaysDayScreen />
    </Suspense>
  );
}
