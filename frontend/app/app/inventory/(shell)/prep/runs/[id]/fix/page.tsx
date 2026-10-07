import { Suspense } from 'react';

import { FixRunRoute } from '@/features/inventory/prep';

export default function PrepFixRunPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <FixRunRoute runId={params.id} />
    </Suspense>
  );
}
