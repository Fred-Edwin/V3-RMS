export type AppRole =
  | 'SYSTEM_ADMIN'
  | 'DIRECTOR'
  | 'MANAGER'
  | 'ACCOUNTANT'
  | 'WAITER'
  | 'CHEF'
  | 'BARISTA'
  | 'KITCHEN_DISPLAY'
  | 'BARISTA_DISPLAY'
  | 'HR_MANAGER'
  | 'STEWARD'
  | 'HOUSEKEEPING'
  | 'STORE_MANAGER'
  | 'STORE_ATTENDANT';

export type DepartmentTag = 'KITCHEN' | 'PASTRY' | 'BARISTA' | 'SERVICE' | 'HOUSEKEEPING';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  organizationId: string | null;
  organizationName?: string | null;
  /** Which department this person heads, if any (marker model, 2026-09-03). */
  departmentTag?: DepartmentTag | null;
  isDepartmentHead?: boolean;
}
