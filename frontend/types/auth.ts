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
  | 'HOUSEKEEPING';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  organizationId: string | null;
  organizationName?: string | null;
}
