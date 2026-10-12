'use client';

import { useParams } from 'next/navigation';

import { ReviewLinesScreen } from '@/features/inventory/dispatch';

export default function ReviewLinesPage() {
  const params = useParams();
  const requisitionId = typeof params.requisitionId === 'string' ? params.requisitionId : '';
  return <ReviewLinesScreen requisitionId={requisitionId} />;
}
