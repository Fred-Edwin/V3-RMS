'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { MyDeliveriesList } from '@/features/inventory/deliveries';
import { HeadHistoryScreen } from '@/features/inventory/requisitions';

/** The head's History: Requisitions (Block 1) and Deliveries (gap fix G2) are two tabs of the one page. */
function HistoryTabs() {
  const tab = useSearchParams().get('tab');
  return tab === 'deliveries' ? <MyDeliveriesList withTabs /> : <HeadHistoryScreen />;
}

export default function RequisitionHistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryTabs />
    </Suspense>
  );
}
