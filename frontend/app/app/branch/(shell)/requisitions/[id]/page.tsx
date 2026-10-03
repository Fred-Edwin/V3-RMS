'use client';

import { useParams, useRouter } from 'next/navigation';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { RequisitionApprovalMobileScreen } from '@/features/inventory/requisitions/components/screens/requisition-approval-mobile-screen';

/**
 * Mobile-only review route (M3 family) — the desktop master-detail handles
 * the same detail via `?id=` on the list route instead. A desktop viewer
 * landing here (e.g. a bookmarked link) is redirected back to that pattern.
 */
export default function BranchRequisitionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');

  if (!hydrated) return null;
  if (isDesktop) {
    router.replace(`/app/branch/requisitions?id=${params.id}`);
    return null;
  }
  return <RequisitionApprovalMobileScreen requisitionId={params.id} />;
}
