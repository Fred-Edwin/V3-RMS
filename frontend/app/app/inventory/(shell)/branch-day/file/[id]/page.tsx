'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { BranchDayFileScreen } from '@/features/inventory';

// The tab, department and page live in the URL, so useSearchParams() needs a Suspense boundary.
export default function BranchDayFilePage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return (
    <Suspense fallback={null}>
      <BranchDayFileScreen dayId={id} />
    </Suspense>
  );
}
