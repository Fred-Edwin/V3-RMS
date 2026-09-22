'use client';

import { Suspense } from 'react';

import { DiscrepanciesListScreen } from '@/features/dispatch';

export default function InventoryDiscrepanciesPage() {
  return (
    <Suspense fallback={null}>
      <DiscrepanciesListScreen />
    </Suspense>
  );
}
