'use client';

import { useParams } from 'next/navigation';

import { SentScreen } from '@/features/inventory/dispatch';

export default function SentPage() {
  const params = useParams();
  const requisitionId = typeof params.requisitionId === 'string' ? params.requisitionId : '';
  return <SentScreen requisitionId={requisitionId} />;
}
