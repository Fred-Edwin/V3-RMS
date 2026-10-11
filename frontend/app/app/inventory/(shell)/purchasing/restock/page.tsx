import { Suspense } from 'react';

import { AttendantOnly } from '@/features/inventory/purchasing/components/phone/gate';
import { RestockListScreen } from '@/features/inventory/purchasing/components/phone/restock-list-screen';

export default function RestockListPage() {
  return (
    <Suspense>
      <AttendantOnly>
        <RestockListScreen />
      </AttendantOnly>
    </Suspense>
  );
}
