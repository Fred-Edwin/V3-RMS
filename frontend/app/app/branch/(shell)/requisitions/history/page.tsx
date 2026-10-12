import { Suspense } from 'react';

import { RequisitionsListScreen } from '@/features/inventory';

export default function BranchRequisitionsHistoryPage() {
  return (
    <Suspense>
      <RequisitionsListScreen base="/app/branch/requisitions" mode="history" />
    </Suspense>
  );
}
