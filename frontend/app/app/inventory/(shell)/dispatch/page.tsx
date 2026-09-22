'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { DispatchQueueFulfilScreen } from '@/features/dispatch';

function DispatchPageInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? undefined;
  return <DispatchQueueFulfilScreen requisitionId={id} />;
}

// See the identical comment in app/app/branch/(shell)/deliveries/page.tsx —
// useSearchParams() needs a Suspense boundary or a query-only client
// navigation (selecting a queue row) blanks the whole page.
export default function DispatchPage() {
  return (
    <Suspense fallback={null}>
      <DispatchPageInner />
    </Suspense>
  );
}
