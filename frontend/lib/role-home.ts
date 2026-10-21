import type { AppRole } from '@/types/auth';

/** The Home every human role lands on after sign-in (Workforce final pass, batch 2A). The two kitchen display screens keep their own. */
const HOME = '/app/workforce';

export const roleHome: Record<AppRole, string> = {
  WAITER: HOME,
  CHEF: HOME,
  BARISTA: HOME,
  KITCHEN_DISPLAY: '/app/kitchen',
  BARISTA_DISPLAY: '/app/barista',
  MANAGER: HOME,
  DIRECTOR: HOME,
  ACCOUNTANT: HOME,
  SYSTEM_ADMIN: HOME,
  HR_MANAGER: HOME,
  STEWARD: HOME,
  HOUSEKEEPING: HOME,
  STORE_MANAGER: HOME,
  STORE_ATTENDANT: HOME,
};
