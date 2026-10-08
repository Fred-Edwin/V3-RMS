import { Suspense } from 'react';

import { DepartmentsScreen } from '@/features/inventory';

/** Paper step 20: Departments in Settings, for the Branch Manager. (`/app/manage/departments` is the old head-assignment page.) */
export default function DepartmentSettingsPage() {
  return (
    <Suspense>
      <DepartmentsScreen breadcrumb={{ section: 'Manage', screen: 'Departments' }} />
    </Suspense>
  );
}
