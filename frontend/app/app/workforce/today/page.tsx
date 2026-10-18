import { Suspense } from 'react';

import { TodayScreen } from '@/features/workforce/home';

export default function TodayBoardPage() {
  // The screen reads the address (a day, a shift to review), which Next needs inside a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <TodayScreen />
    </Suspense>
  );
}
