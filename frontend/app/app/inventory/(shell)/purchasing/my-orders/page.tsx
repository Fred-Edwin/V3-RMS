import { Suspense } from 'react';

import { AttendantOnly } from '@/features/inventory/purchasing/components/phone/gate';
import { MyOrdersScreen } from '@/features/inventory/purchasing/components/phone/my-orders-screen';

export default function MyOrdersPage() {
  return (
    <Suspense>
      <AttendantOnly>
        <MyOrdersScreen />
      </AttendantOnly>
    </Suspense>
  );
}
