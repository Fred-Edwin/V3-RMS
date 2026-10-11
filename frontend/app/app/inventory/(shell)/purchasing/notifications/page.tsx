import { Suspense } from 'react';

import { AttendantOnly } from '@/features/inventory/purchasing/components/phone/gate';
import { NotificationsScreen } from '@/features/inventory/purchasing/components/phone/notifications-screen';

export default function PurchasingNotificationsPage() {
  return (
    <Suspense>
      <AttendantOnly>
        <NotificationsScreen />
      </AttendantOnly>
    </Suspense>
  );
}
