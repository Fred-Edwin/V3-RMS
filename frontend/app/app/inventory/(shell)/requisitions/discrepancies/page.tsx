import { Suspense } from 'react';

import { RequisitionsListScreen } from '@/features/inventory';

export default function InventoryRequisitionsDiscrepanciesPage() {
  return (
    <Suspense>
      <RequisitionsListScreen base="/app/inventory/requisitions" mode="discrepancies" />
    </Suspense>
  );
}
