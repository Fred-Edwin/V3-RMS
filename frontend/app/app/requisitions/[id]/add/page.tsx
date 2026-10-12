import { Suspense } from 'react';

import { HeadAdditionScreen } from '@/features/inventory/requisitions';

export default function RequisitionAddPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <HeadAdditionScreen requisitionId={params.id} />
    </Suspense>
  );
}
