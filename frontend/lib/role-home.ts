import type { AppRole } from '@/types/auth';

export const roleHome: Record<AppRole, string> = {
  WAITER: '/app/dashboard',
  CHEF: '/app/dashboard',
  BARISTA: '/app/dashboard',
  KITCHEN_DISPLAY: '/app/kitchen',
  BARISTA_DISPLAY: '/app/barista',
  MANAGER: '/app/manage/dashboard',
  DIRECTOR: '/app/director',
  ACCOUNTANT: '/app/accountant',
  SYSTEM_ADMIN: '/app/admin',
  HR_MANAGER: '/app/hr',
  STEWARD: '/app/dashboard',
  HOUSEKEEPING: '/app/dashboard',
  STORE_MANAGER: '/app/inventory/dashboard',
  STORE_ATTENDANT: '/app/inventory/stock',
};
