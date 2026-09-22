'use client';

import { useParams } from 'next/navigation';

import { DiscrepancyResolutionScreen } from '@/features/dispatch';

export default function InventoryDiscrepancyDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return <DiscrepancyResolutionScreen discrepancyId={id} />;
}
