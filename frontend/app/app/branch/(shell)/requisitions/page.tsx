import { Suspense } from 'react';

import { RequisitionsListScreen } from '@/features/inventory';

export default function BranchRequisitionsPage() {
  return (
    <Suspense>
      <RequisitionsListScreen base="/app/branch/requisitions" mode="queue" />
    </Suspense>
  );
}
