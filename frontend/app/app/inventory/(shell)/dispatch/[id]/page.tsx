'use client';

import { useParams } from 'next/navigation';

import { DispatchFileScreen } from '@/features/inventory/dispatch';

export default function DispatchFilePage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return <DispatchFileScreen id={id} />;
}
