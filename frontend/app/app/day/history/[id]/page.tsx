'use client';

import { useParams } from 'next/navigation';

import { DayPastDayScreen } from '@/features/inventory';

export default function DayPastDayPage() {
  const params = useParams();
  return <DayPastDayScreen id={typeof params.id === 'string' ? params.id : ''} />;
}
