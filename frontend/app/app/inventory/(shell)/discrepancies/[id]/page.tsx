'use client';

import { useParams } from 'next/navigation';

import { DiscrepancyResolutionScreen } from '@/features/inventory/dispatch';

export default function InventoryDiscrepancyDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return <DiscrepancyResolutionScreen discrepancyId={id} />;
}
