import { Suspense } from 'react';

import { PersonMonthScreen } from '@/features/workforce/timesheets';

export default function PersonMonthPage() {
  // The screen reads the address (?site=&from=&to=&view=), which Next needs inside a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <PersonMonthScreen />
    </Suspense>
  );
}
