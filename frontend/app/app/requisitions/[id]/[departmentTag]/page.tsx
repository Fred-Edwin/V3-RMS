'use client';

import { useParams } from 'next/navigation';

import { RequisitionSectionFillScreen } from '@/features/requisitions';
import type { DepartmentTag } from '@/features/requisitions';

export default function RequisitionSectionFillPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const departmentTag = typeof params.departmentTag === 'string' ? (params.departmentTag as DepartmentTag) : ('KITCHEN' as DepartmentTag);
  return <RequisitionSectionFillScreen requisitionId={id} departmentTag={departmentTag} />;
}
