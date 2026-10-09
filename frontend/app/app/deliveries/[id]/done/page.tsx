'use client';

import { useParams } from 'next/navigation';

import { ConfirmedScreen } from '@/features/inventory/deliveries';

export default function ConfirmedPage() {
  const params = useParams();
  return <ConfirmedScreen id={typeof params.id === 'string' ? params.id : ''} />;
}
