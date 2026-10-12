import { Suspense } from 'react';

import { MyDeliveriesList } from '@/features/inventory/deliveries';

export default function MemberHistoryPage() {
  return (
    <Suspense fallback={null}>
      <MyDeliveriesList />
    </Suspense>
  );
}
