'use client';

import { useParams } from 'next/navigation';

import { PackDepartmentScreen } from '@/features/inventory/dispatch';

export default function PackDepartmentPage() {
  const params = useParams();
  const requisitionId = typeof params.requisitionId === 'string' ? params.requisitionId : '';
  const departmentId = typeof params.departmentId === 'string' ? params.departmentId : '';
  return <PackDepartmentScreen key={`${requisitionId}:${departmentId}`} requisitionId={requisitionId} departmentId={departmentId} />;
}
