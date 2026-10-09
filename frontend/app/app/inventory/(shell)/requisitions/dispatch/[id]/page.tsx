'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { DispatchFileScreen } from '@/features/inventory';

export default function InventoryDispatchFilePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense>
      <DispatchFileScreen id={id} base="/app/inventory/requisitions" printBase="/app/branch/dispatch-print" packHref="/app/inventory/dispatch" section="Central Store" />
    </Suspense>
  );
}
