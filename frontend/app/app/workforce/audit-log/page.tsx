import { Suspense } from 'react';

import { AuditLogPage } from '@/features/workforce/audit';

export default function AuditLogRoute() {
  return (
    <Suspense>
      <AuditLogPage />
    </Suspense>
  );
}
