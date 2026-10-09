'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { DispatchFileScreen } from '@/features/inventory';

export default function BranchDispatchFilePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense>
      <DispatchFileScreen id={id} base="/app/branch/requisitions" printBase="/app/branch/dispatch-print" packHref="/app/branch/requisitions" section="Branch" />
    </Suspense>
  );
}
