import { Suspense } from 'react';

import { RecordRunScreen } from '@/features/inventory';

export default function NewPrepRunPage() {
  return (
    <Suspense>
      <RecordRunScreen />
    </Suspense>
  );
}
