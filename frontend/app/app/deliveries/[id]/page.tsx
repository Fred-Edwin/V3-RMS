'use client';

import { useParams } from 'next/navigation';

import { DeliveryFileScreen } from '@/features/inventory/deliveries';

export default function DeliveryFilePage() {
  const params = useParams();
  return <DeliveryFileScreen id={typeof params.id === 'string' ? params.id : ''} />;
}
