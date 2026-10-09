'use client';

import { useParams } from 'next/navigation';

import { FinalReviewScreen } from '@/features/inventory/dispatch';

export default function FinalReviewPage() {
  const params = useParams();
  const requisitionId = typeof params.requisitionId === 'string' ? params.requisitionId : '';
  return <FinalReviewScreen requisitionId={requisitionId} />;
}
