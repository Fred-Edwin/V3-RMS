'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { DiscrepancyFileScreen } from '@/features/inventory';

export default function InventoryDiscrepancyFilePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense>
      <DiscrepancyFileScreen id={id} base="/app/inventory/requisitions" section="Central Store" />
    </Suspense>
  );
}
