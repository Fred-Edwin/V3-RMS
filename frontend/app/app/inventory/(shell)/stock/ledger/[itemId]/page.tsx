'use client';

import { Suspense } from 'react';

import { StockCardScreen } from '@/features/inventory';

// The period, view and chip live in the URL, so useSearchParams() needs a Suspense boundary.
export default function StockCardPage({ params }: { params: { itemId: string } }) {
  return (
    <Suspense fallback={null}>
      <StockCardScreen itemId={params.itemId} />
    </Suspense>
  );
}
