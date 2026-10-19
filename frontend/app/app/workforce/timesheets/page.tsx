import { Suspense } from 'react';

import { MonthsScreen } from '@/features/workforce/timesheets';

export default function TimesheetsPage() {
  // The screen keeps the branch, month, days and open person in the address, which Next needs inside a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <MonthsScreen />
    </Suspense>
  );
}
