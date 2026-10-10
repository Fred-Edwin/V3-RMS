'use client';

import { Suspense } from 'react';

import { BranchDayTodayScreen } from '@/features/inventory';

// The hub roles' Today: the same screen as the Branch Manager's, read only, with a branch picker. The branch lives in the URL.
export default function BranchDayHubPage() {
  return (
    <Suspense fallback={null}>
      <BranchDayTodayScreen />
    </Suspense>
  );
}
