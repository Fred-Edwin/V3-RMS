'use client';

import { Suspense } from 'react';

import { DiscrepanciesListScreen } from '@/features/dispatch';

export default function BranchDiscrepanciesPage() {
  return (
    <Suspense fallback={null}>
      <DiscrepanciesListScreen />
    </Suspense>
  );
}
