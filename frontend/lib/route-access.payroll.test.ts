import { describe, expect, it } from 'vitest';

import type { AppRole } from '@/types/auth';
import { isAllowedPath } from './route-access';

const ALL: AppRole[] = ['WAITER', 'CHEF', 'BARISTA', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY', 'MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'HR_MANAGER', 'SYSTEM_ADMIN', 'STEWARD', 'HOUSEKEEPING', 'STORE_MANAGER', 'STORE_ATTENDANT'];
const PAYROLL: AppRole[] = ['HR_MANAGER', 'ACCOUNTANT', 'DIRECTOR', 'SYSTEM_ADMIN'];

describe('route gate: /app/workforce/payroll', () => {
  it('opens for HR, the Accountant, the Director and the System Admin, and for nobody else', () => {
    for (const role of ALL) {
      expect(isAllowedPath('/app/workforce/payroll', role, false), `${role} on payroll`).toBe(PAYROLL.includes(role));
    }
  });

  it('keeps Branch Managers and Store Managers out, so they see no pay', () => {
    for (const role of ['MANAGER', 'STORE_MANAGER'] as AppRole[]) expect(isAllowedPath('/app/workforce/payroll', role, false)).toBe(false);
  });
});
