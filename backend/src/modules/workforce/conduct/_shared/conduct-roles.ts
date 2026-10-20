import type { UserRole } from '@prisma/client';

/** How a login's role reads in a message or on a signed record ("Faith Njeri, Branch Manager"). */
const ROLE_NAMES: Partial<Record<UserRole, string>> = {
  MANAGER: 'Branch Manager',
  STORE_MANAGER: 'Store Manager',
  HR_MANAGER: 'HR',
  DIRECTOR: 'Director',
  ACCOUNTANT: 'Accountant',
  SYSTEM_ADMIN: 'System Admin',
  STORE_ATTENDANT: 'Store Attendant',
  DEPARTMENT_HEAD: 'Department head',
};

export const roleName = (role: UserRole | string | null): string => {
  if (!role) return 'Staff';
  const known = ROLE_NAMES[role as UserRole];
  if (known) return known;
  return role.split('_').map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(' ');
};

/** A notice HR issued is decided on appeal by the Director, never by HR (C8). The issuer's role is frozen on the notice. */
export const issuedByHr = (notice: { issuerRole: string }): boolean => notice.issuerRole === roleName('HR_MANAGER');
