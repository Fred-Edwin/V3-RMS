import { Suspense } from 'react';

import { DiscrepanciesListScreen } from '@/features/inventory';

export default function BranchRequisitionsDiscrepanciesPage() {
  return (
    <Suspense>
      <DiscrepanciesListScreen base="/app/branch/requisitions" section="Branch" />
    </Suspense>
  );
}
