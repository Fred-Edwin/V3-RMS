'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { BranchIncomingConfirmScreen, BranchIncomingScreenMobile } from '@/features/inventory/dispatch';

function BranchDeliveriesPageInner() {
  const searchParams = useSearchParams();
  const dispatchId = searchParams.get('id') ?? '';
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');

  if (!hydrated) return null;
  if (!isDesktop) return <BranchIncomingScreenMobile />;
  return <BranchIncomingConfirmScreen dispatchId={dispatchId} />;
}

// useSearchParams() requires a Suspense boundary (Next.js App Router) —
// without one, a client-side query-string-only navigation (e.g. selecting a
// different row in the master-detail rail) forces this whole route segment
// to unmount/remount, producing a blank-page flash. A full document reload
// masks this because the page always re-hydrates fresh; router.push exposes
// it immediately.
export default function BranchDeliveriesPage() {
  return (
    <Suspense fallback={null}>
      <BranchDeliveriesPageInner />
    </Suspense>
  );
}
