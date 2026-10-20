import { Suspense } from 'react';

import { PayrollScreen } from '@/features/workforce/payroll';

export default function PayrollPage() {
  // The screen keeps the month and tab in the address, which Next needs inside a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <PayrollScreen />
    </Suspense>
  );
}
