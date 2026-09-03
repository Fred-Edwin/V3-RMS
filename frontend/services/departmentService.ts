import { apiClient } from '@/lib/apiClient';
import type { AppRole, DepartmentTag } from '@/types/auth';

export const DEPARTMENT_TAGS: DepartmentTag[] = ['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING'];

export interface DepartmentHeadDto {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  isActive: boolean;
  departmentTag: DepartmentTag | null;
}

export interface DepartmentMemberDto {
  id: string;
  name: string;
  role: AppRole;
}

export interface DepartmentSummaryDto {
  departmentTag: DepartmentTag;
  head: DepartmentHeadDto | null;
  /** Active staff whose base role belongs to this department. `members.length`
   *  is the roster count — there is no separate count field. */
  members: DepartmentMemberDto[];
}

export interface EligibleStaffDto {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  isActive: boolean;
  departmentTag: DepartmentTag | null;
}

export const departmentService = {
  listDepartments: (orgId: string, accessToken: string): Promise<DepartmentSummaryDto[]> =>
    apiClient
      .get<{ departments: DepartmentSummaryDto[] }>(`/branches/${orgId}/departments`, accessToken)
      .then((data) => data.departments),

  listEligibleStaff: (orgId: string, tag: DepartmentTag, accessToken: string): Promise<EligibleStaffDto[]> =>
    apiClient
      .get<{ staff: EligibleStaffDto[] }>(`/branches/${orgId}/departments/${tag}/eligible-staff`, accessToken)
      .then((data) => data.staff),

  assignHead: (orgId: string, tag: DepartmentTag, userId: string, accessToken: string): Promise<DepartmentHeadDto> =>
    apiClient
      .patch<{ head: DepartmentHeadDto }>(`/branches/${orgId}/departments/${tag}/head`, { userId }, accessToken)
      .then((data) => data.head),

  unassignHead: (orgId: string, tag: DepartmentTag, accessToken: string): Promise<void> =>
    apiClient
      .delete<{ previous: DepartmentHeadDto }>(`/branches/${orgId}/departments/${tag}/head`, accessToken)
      .then(() => undefined),
};

export const departmentLabels: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};
