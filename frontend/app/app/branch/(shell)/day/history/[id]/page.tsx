'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { DayHistoryDetailScreen } from '@/features/branch-day';

export default function BranchDayHistoryDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return (
    <Suspense fallback={null}>
      <DayHistoryDetailScreen dayId={id} />
    </Suspense>
  );
}
