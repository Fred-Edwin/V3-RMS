import { Suspense } from 'react';

import { AuditLogScreen } from '@/features/inventory/audit-log/components/screens/audit-log-screen';

export default function AuditLogPage() {
  // The screen reads ?q= (the closed purchase file links here with its LPO number), which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <AuditLogScreen />
    </Suspense>
  );
}
