import { Suspense } from 'react';

import { DepartmentsScreen } from '@/features/inventory';

/** Paper G4: the Director reads any branch's departments (read only, with a branch picker). */
export default function DirectorDepartmentsPage() {
  return (
    <Suspense>
      <DepartmentsScreen breadcrumb={{ root: 'Operations', section: 'Branch Settings', screen: 'Departments' }} />
    </Suspense>
  );
}
