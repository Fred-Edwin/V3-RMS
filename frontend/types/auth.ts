export type AppRole =
  | 'SYSTEM_ADMIN'
  | 'DIRECTOR'
  | 'STORE_MANAGER'
  | 'MANAGER'
  | 'WAITER'
  | 'CHEF'
  | 'BARISTA'
  | 'KITCHEN_DISPLAY'
  | 'BARISTA_DISPLAY';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  organizationId: string | null;
  organizationName?: string | null;
}
