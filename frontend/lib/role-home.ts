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
  // Dashboards aren't in scope yet, so each role lands on the screen of its daily job:
  // the Store Manager on the requisition queue, the Store Attendant on To pack.
  STORE_MANAGER: '/app/inventory/requisitions',
  STORE_ATTENDANT: '/app/inventory/dispatch',
};
