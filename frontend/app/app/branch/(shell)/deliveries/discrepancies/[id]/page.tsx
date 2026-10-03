'use client';

import { useParams } from 'next/navigation';

import { DiscrepancyDetailScreen } from '@/features/inventory/dispatch';

export default function BranchDiscrepancyDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return <DiscrepancyDetailScreen discrepancyId={id} />;
}
