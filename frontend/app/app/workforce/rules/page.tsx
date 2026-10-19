import { Suspense } from 'react';

import { RulesScreen } from '@/features/workforce/rules';

export default function RulesPage() {
  return (
    <Suspense fallback={null}>
      <RulesScreen />
    </Suspense>
  );
}
