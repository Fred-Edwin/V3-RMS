import { Suspense } from 'react';

import { OrderRoute } from '@/features/inventory/purchasing/components/phone/order-route';

export default async function PurchaseFilePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return (
    <Suspense>
      <OrderRoute orderId={orderId} />
    </Suspense>
  );
}
