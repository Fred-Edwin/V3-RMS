'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { DiscrepancyFileScreen } from '@/features/inventory';

export default function BranchDiscrepancyFilePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense>
      <DiscrepancyFileScreen id={id} base="/app/branch/requisitions" section="Branch" />
    </Suspense>
  );
}
