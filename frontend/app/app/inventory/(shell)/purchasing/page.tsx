import { Suspense } from 'react';

import { PurchasingScreen } from '@/features/inventory/purchasing/components/screens/purchasing-screen';

export default function PurchasingPage() {
  return (
    <Suspense>
      <PurchasingScreen />
    </Suspense>
  );
}
