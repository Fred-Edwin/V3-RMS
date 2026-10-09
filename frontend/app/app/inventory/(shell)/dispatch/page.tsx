import { Suspense } from 'react';

import { AttendantDispatchScreen } from '@/features/inventory/dispatch';

export default function DispatchPage() {
  return (
    <Suspense fallback={null}>
      <AttendantDispatchScreen />
    </Suspense>
  );
}
