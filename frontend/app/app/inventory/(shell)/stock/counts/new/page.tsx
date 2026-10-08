'use client';

import { Suspense } from 'react';

import { StartCountScreen } from '@/features/inventory';

// `?recount=<lineId>` (the item being counted again) is read inside the screen, so it needs a Suspense boundary.
export default function NewCountPage() {
  return (
    <Suspense fallback={null}>
      <StartCountScreen />
    </Suspense>
  );
}
