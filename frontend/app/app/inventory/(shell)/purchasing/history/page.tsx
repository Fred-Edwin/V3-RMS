import { Suspense } from 'react';

import { AttendantOnly } from '@/features/inventory/purchasing/components/phone/gate';
import { HistoryScreen } from '@/features/inventory/purchasing/components/phone/history-screen';

export default function PurchasingHistoryPage() {
  return (
    <Suspense>
      <AttendantOnly>
        <HistoryScreen />
      </AttendantOnly>
    </Suspense>
  );
}
