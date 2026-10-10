'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { BranchDaySheetPrintScreen } from '@/features/inventory';

/**
 * The printed day sheet for the hub roles (read only). A bare page, outside `(shell)`: no sidebar or top bar, like the other `-print`
 * routes. `?version=` prints that stored copy.
 */
export default function InventoryDaySheetPrintPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return (
    <Suspense fallback={null}>
      <BranchDaySheetPrintScreen dayId={id} />
    </Suspense>
  );
}
