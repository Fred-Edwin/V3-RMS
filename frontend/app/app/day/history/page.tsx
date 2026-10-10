import { Suspense } from 'react';

import { DayPastDaysScreen } from '@/features/inventory';

// useSearchParams() (the filters and the page) needs a Suspense boundary.
export default function DayHistoryPage() {
  return (
    <Suspense fallback={null}>
      <DayPastDaysScreen />
    </Suspense>
  );
}
