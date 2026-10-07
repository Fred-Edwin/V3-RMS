'use client';

import { Suspense } from 'react';

import { DepartmentStockLedgerScreen as StockLedgerScreen } from '@/features/inventory';

// useSearchParams() (range / page / highlight live in the URL) needs a Suspense boundary.
export default function DepartmentLedgerPage({ params }: { params: { itemId: string } }) {
  return (
    <Suspense fallback={null}>
      <StockLedgerScreen itemId={params.itemId} scope="department" />
    </Suspense>
  );
}
