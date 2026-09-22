'use client';

import { useSearchParams } from 'next/navigation';

import { DispatchQueueFulfilScreen } from '@/features/dispatch';

export default function DispatchPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? undefined;
  return <DispatchQueueFulfilScreen requisitionId={id} />;
}
