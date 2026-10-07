'use client';

import { Suspense } from 'react';

import { CountSetupScreen } from '@/features/inventory';

// `?drawer=` (Add items, Count settings) lives in the URL, so useSearchParams() needs a Suspense boundary.
export default function CountSetupPage() {
  return (
    <Suspense fallback={null}>
      <CountSetupScreen />
    </Suspense>
  );
}
