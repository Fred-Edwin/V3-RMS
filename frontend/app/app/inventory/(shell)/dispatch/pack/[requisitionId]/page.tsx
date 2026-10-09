'use client';

import { useParams } from 'next/navigation';

import { PackOverviewScreen } from '@/features/inventory/dispatch';

export default function PackOverviewPage() {
  const params = useParams();
  const requisitionId = typeof params.requisitionId === 'string' ? params.requisitionId : '';
  return <PackOverviewScreen requisitionId={requisitionId} />;
}
