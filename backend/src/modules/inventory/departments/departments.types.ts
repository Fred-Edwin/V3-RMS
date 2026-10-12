import type { DepartmentStatus, DepartmentTag, UserRole } from '@prisma/client';

export interface BranchPickRecord {
  id: string;
  name: string;
  code: string | null;
}

export interface DepartmentRecord {
  id: string;
  siteId: string;
  name: string;
  key: DepartmentTag | null;
  status: DepartmentStatus;
  position: number;
  retiredAt: Date | null;
}

export interface DepartmentHeadRecord {
  id: string;
  name: string;
  role: UserRole;
  departmentId: string;
}
