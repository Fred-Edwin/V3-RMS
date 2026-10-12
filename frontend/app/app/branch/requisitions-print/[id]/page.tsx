'use client';

import { useParams } from 'next/navigation';

import { RequisitionPrintScreen } from '@/features/inventory';

/** Standalone print route (no sidebar, no top bar): the printed requisition, Paper step 17. */
export default function RequisitionPrintPage() {
  const { id } = useParams<{ id: string }>();
  return <RequisitionPrintScreen requisitionId={id} />;
}
