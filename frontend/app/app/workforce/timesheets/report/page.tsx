import { Suspense } from 'react';

import { ReportScreen } from '@/features/workforce/timesheets';

export default function TimesheetReportPage() {
  // The screen reads ?period=, which Next needs inside a Suspense boundary. The route is bare (no sidebar): it is the page you print.
  return (
    <Suspense fallback={null}>
      <ReportScreen />
    </Suspense>
  );
}
