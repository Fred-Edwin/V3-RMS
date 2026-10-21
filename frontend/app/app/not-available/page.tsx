import { Suspense } from 'react';

import { RefusalScreen } from '@/features/workforce/refusal';

export default function NotAvailablePage() {
  return (
    <Suspense fallback={null}>
      <RefusalScreen />
    </Suspense>
  );
}
