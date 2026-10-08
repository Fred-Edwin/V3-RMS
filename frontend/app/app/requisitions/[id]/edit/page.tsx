import { Suspense } from 'react';

import { HeadEditScreen } from '@/features/inventory/requisitions';

export default function RequisitionEditPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <HeadEditScreen requisitionId={params.id} />
    </Suspense>
  );
}
