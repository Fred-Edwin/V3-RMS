'use client';

import { useParams } from 'next/navigation';

import { DeliveryNoteScreen } from '@/features/inventory/dispatch';

export default function DeliveryNotePage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return <DeliveryNoteScreen dispatchId={id} />;
}
