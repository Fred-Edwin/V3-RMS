import { Suspense } from 'react';

import { AttendantOnly } from '@/features/inventory/purchasing/components/phone/gate';
import { SupplierScreen } from '@/features/inventory/purchasing/components/phone/supplier-screen';

export default async function PurchasingSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <AttendantOnly>
        <SupplierScreen supplierId={id} />
      </AttendantOnly>
    </Suspense>
  );
}
