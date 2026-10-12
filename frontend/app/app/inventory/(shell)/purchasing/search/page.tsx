import { Suspense } from 'react';

import { AttendantOnly } from '@/features/inventory/purchasing/components/phone/gate';
import { SearchScreen } from '@/features/inventory/purchasing/components/phone/search-screen';

export default function PurchasingSearchPage() {
  return (
    <Suspense>
      <AttendantOnly>
        <SearchScreen />
      </AttendantOnly>
    </Suspense>
  );
}
