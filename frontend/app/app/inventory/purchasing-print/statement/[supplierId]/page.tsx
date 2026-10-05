import { Suspense } from 'react';

import { StatementPrintScreen } from '@/features/inventory/purchasing/components/screens/statement-print-screen';

/** Standalone print route for a supplier statement (Paper `27`): outside `(shell)`, no sidebar or top bar. */
export default async function StatementPrintPage({ params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params;
  return (
    <Suspense fallback={null}>
      <StatementPrintScreen supplierId={supplierId} />
    </Suspense>
  );
}
