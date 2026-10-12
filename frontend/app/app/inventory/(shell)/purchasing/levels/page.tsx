import { Suspense } from 'react';

import { AttendantOnly } from '@/features/inventory/purchasing/components/phone/gate';
import { LevelsScreen } from '@/features/inventory/purchasing/components/phone/levels-screen';

export default function PurchasingLevelsPage() {
  return (
    <Suspense>
      <AttendantOnly>
        <LevelsScreen />
      </AttendantOnly>
    </Suspense>
  );
}
