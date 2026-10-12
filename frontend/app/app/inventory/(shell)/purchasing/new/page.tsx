import { Suspense } from 'react';

import { NewOrderRoute } from '@/features/inventory/purchasing/components/phone/new-order-route';

export default function NewOrderPage() {
  return (
    <Suspense>
      <NewOrderRoute />
    </Suspense>
  );
}
