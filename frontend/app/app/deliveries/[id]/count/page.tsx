'use client';

import { useParams } from 'next/navigation';

import { CountScreen } from '@/features/inventory/deliveries';

export default function CountPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return <CountScreen key={id} id={id} />;
}
