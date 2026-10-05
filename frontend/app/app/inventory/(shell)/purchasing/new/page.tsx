import { Suspense } from 'react';

import { NewOrderScreen } from '@/features/inventory/purchasing/components/screens/new-order-screen';

export default function NewOrderPage() {
  return (
    <Suspense>
      <NewOrderScreen />
    </Suspense>
  );
}
