import { describe, expect, it } from 'vitest';

import type { AppRole } from '@/types/auth';
import { isAllowedPath } from './route-access';

const ALL: AppRole[] = ['WAITER', 'CHEF', 'BARISTA', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY', 'MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'HR_MANAGER', 'SYSTEM_ADMIN', 'STEWARD', 'HOUSEKEEPING', 'STORE_MANAGER', 'STORE_ATTENDANT'];
const CASUAL_DESKTOP: AppRole[] = ['MANAGER', 'STORE_MANAGER', 'HR_MANAGER', 'ACCOUNTANT', 'DIRECTOR'];

describe('route gate: My payslips (Segment 3)', () => {
  for (const path of ['/app/workforce/my-payslips', '/app/workforce/my-payslips/history', '/app/workforce/my-payslips/abc/document', '/app/workforce/my-payslips/p9/2024']) {
    it(`${path} opens for everyone except the System Admin`, () => {
      for (const role of ALL) expect(isAllowedPath(path, role, false), `${role} on ${path}`).toBe(role !== 'SYSTEM_ADMIN');
    });
  }
});

describe('route gate: Casual pay (Segment 3)', () => {
  for (const path of ['/app/workforce/casuals', '/app/workforce/casuals/approve', '/app/workforce/casuals/preview', '/app/workforce/casuals/abc/document']) {
    it(`${path} opens for the desktop roles, and for a department head`, () => {
      for (const role of ALL) {
        expect(isAllowedPath(path, role, false), `${role} on ${path}`).toBe(CASUAL_DESKTOP.includes(role));
        expect(isAllowedPath(path, role, true), `head ${role} on ${path}`).toBe(true);
      }
    });
  }
});
