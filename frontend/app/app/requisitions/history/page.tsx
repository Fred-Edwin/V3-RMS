import { Suspense } from 'react';

import { HeadHistoryScreen } from '@/features/inventory/requisitions';

export default function RequisitionHistoryPage() {
  return (
    <Suspense fallback={null}>
      <HeadHistoryScreen />
    </Suspense>
  );
}
