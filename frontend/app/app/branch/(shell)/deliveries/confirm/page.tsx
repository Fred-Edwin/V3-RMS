'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ConfirmReceiptScreenMobile } from '@/features/inventory/dispatch';

function ConfirmDeliveryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatchId = searchParams.get('id') ?? '';
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');

  if (!hydrated) return null;
  // Desktop confirms inline in the master-detail rail on /app/branch/deliveries — this route is mobile-only.
  if (isDesktop) {
    router.replace(`/app/branch/deliveries?id=${dispatchId}`);
    return null;
  }
  return <ConfirmReceiptScreenMobile dispatchId={dispatchId} />;
}

// useSearchParams() requires a Suspense boundary (Next.js App Router) — see
// the sibling deliveries/page.tsx comment for why this matters even for a
// query-only client navigation.
export default function ConfirmDeliveryPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmDeliveryPageInner />
    </Suspense>
  );
}
