import { Suspense } from 'react';

import { ReportProblemScreen } from '@/features/workforce/timesheets';

export default function ReportProblemPage() {
  // The screen reads ?date= (a day chosen from My time), which Next needs inside a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <ReportProblemScreen />
    </Suspense>
  );
}
