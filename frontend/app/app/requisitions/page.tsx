import { Suspense } from 'react';

import { HeadHomeScreen } from '@/features/inventory/requisitions';

export default function RequisitionsPage() {
  return (
    <Suspense fallback={null}>
      <HeadHomeScreen />
    </Suspense>
  );
}
