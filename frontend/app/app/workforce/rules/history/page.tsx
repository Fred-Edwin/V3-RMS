import { Suspense } from 'react';

import { HistoryScreen } from '@/features/workforce/rules';

export default function RulesHistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryScreen />
    </Suspense>
  );
}
