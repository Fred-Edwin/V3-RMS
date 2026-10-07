'use client';

import { Suspense } from 'react';

import { CountScreen } from '@/features/inventory';

// useSearchParams() (`?line=` opens one line to change it) needs a Suspense boundary.
export default function CountPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <CountScreen countId={params.id} />
    </Suspense>
  );
}
