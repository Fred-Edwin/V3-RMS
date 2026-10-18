import { Suspense } from 'react';

import { PrintRoute } from '@/features/workforce/rota';

export default function RotaPrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintRoute />
    </Suspense>
  );
}
