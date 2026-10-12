import { Suspense } from 'react';

import { RequisitionsListScreen } from '@/features/inventory';

export default function InventoryRequisitionsHistoryPage() {
  return (
    <Suspense>
      <RequisitionsListScreen base="/app/inventory/requisitions" mode="history" />
    </Suspense>
  );
}
