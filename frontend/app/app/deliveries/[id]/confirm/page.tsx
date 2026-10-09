'use client';

import { useParams } from 'next/navigation';

import { ConfirmScreen } from '@/features/inventory/deliveries';

export default function ConfirmPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return <ConfirmScreen key={id} id={id} />;
}
