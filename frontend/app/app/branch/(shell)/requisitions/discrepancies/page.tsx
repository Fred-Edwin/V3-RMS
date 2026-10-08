import { Suspense } from 'react';

import { RequisitionsListScreen } from '@/features/inventory';

export default function BranchRequisitionsDiscrepanciesPage() {
  return (
    <Suspense>
      <RequisitionsListScreen base="/app/branch/requisitions" mode="discrepancies" />
    </Suspense>
  );
}
