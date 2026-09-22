'use client';

import { useSearchParams } from 'next/navigation';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { RequisitionApprovalScreen } from '@/features/requisitions/components/screens/requisition-approval-screen';
import { RequisitionsForApprovalMobileScreen } from '@/features/requisitions/components/screens/requisitions-for-approval-mobile-screen';

export default function BranchRequisitionsPage() {
  const searchParams = useSearchParams();
  const requisitionId = searchParams.get('id') ?? '';
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');

  if (!hydrated) return null;
  if (!isDesktop) return <RequisitionsForApprovalMobileScreen />;
  return <RequisitionApprovalScreen requisitionId={requisitionId} />;
}
