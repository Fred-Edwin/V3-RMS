'use client';

import { useParams } from 'next/navigation';

import { DayDocumentScreen } from '@/features/branch-day';

export default function BranchDayDocumentPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return <DayDocumentScreen dayId={id} />;
}
