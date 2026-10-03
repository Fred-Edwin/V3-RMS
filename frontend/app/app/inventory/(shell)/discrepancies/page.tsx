'use client';

import { Suspense } from 'react';

import { DiscrepanciesListScreen } from '@/features/inventory/dispatch';

export default function InventoryDiscrepanciesPage() {
  return (
    <Suspense fallback={null}>
      <DiscrepanciesListScreen />
    </Suspense>
  );
}
