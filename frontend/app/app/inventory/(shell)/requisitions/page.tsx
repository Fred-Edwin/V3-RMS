import { Suspense } from 'react';

import { RequisitionsListScreen } from '@/features/inventory';

export default function InventoryRequisitionsPage() {
  return (
    <Suspense>
      <RequisitionsListScreen base="/app/inventory/requisitions" mode="queue" />
    </Suspense>
  );
}
