import { Suspense } from 'react';

import { DiscrepanciesListScreen } from '@/features/inventory';

export default function InventoryRequisitionsDiscrepanciesPage() {
  return (
    <Suspense>
      <DiscrepanciesListScreen base="/app/inventory/requisitions" section="Central Store" />
    </Suspense>
  );
}
