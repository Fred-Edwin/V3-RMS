'use client';

import { Suspense } from 'react';

import { ReviewCountScreen } from '@/features/inventory';

// `?tab=` (which lines are shown) lives in the URL, so useSearchParams() needs a Suspense boundary.
export default function CountDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <ReviewCountScreen countId={params.id} />
    </Suspense>
  );
}
