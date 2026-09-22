'use client';

import { useParams } from 'next/navigation';

import { DeliveryNoteScreen } from '@/features/dispatch';

export default function DeliveryNotePage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return <DeliveryNoteScreen dispatchId={id} />;
}
