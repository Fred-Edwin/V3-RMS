import { Suspense } from 'react';

import { AttendantOnly } from '@/features/inventory/purchasing/components/phone/gate';
import { ReviewScreen } from '@/features/inventory/purchasing/components/phone/review-screen';

export default function RestockReviewPage() {
  return (
    <Suspense>
      <AttendantOnly>
        <ReviewScreen />
      </AttendantOnly>
    </Suspense>
  );
}
