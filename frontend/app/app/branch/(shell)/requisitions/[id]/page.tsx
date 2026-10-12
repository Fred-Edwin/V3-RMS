'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { RequisitionFileScreen } from '@/features/inventory';

export default function BranchRequisitionFilePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense>
      <RequisitionFileScreen id={id} base="/app/branch/requisitions" printBase="/app/branch/requisitions-print" section="Branch" />
    </Suspense>
  );
}
