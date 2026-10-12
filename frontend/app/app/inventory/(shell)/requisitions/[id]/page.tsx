'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { RequisitionFileScreen } from '@/features/inventory';

export default function InventoryRequisitionFilePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense>
      <RequisitionFileScreen id={id} base="/app/inventory/requisitions" printBase="/app/branch/requisitions-print" section="Central Store" />
    </Suspense>
  );
}
