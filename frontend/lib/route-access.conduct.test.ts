import { describe, expect, it } from 'vitest';

import type { AppRole } from '@/types/auth';
import { isAllowedPath } from './route-access';

const ALL: AppRole[] = ['WAITER', 'CHEF', 'BARISTA', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY', 'MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'HR_MANAGER', 'SYSTEM_ADMIN', 'STEWARD', 'HOUSEKEEPING', 'STORE_MANAGER', 'STORE_ATTENDANT'];
const DESK: AppRole[] = ['MANAGER', 'STORE_MANAGER', 'HR_MANAGER', 'DIRECTOR'];

describe('route gate: Conduct, a person’s own notices (Segment 5)', () => {
  for (const path of ['/app/conduct', '/app/conduct/abc', '/app/conduct/abc/sign', '/app/conduct/abc/appeal', '/app/conduct/abc/document', '/app/conduct/witness/abc']) {
    it(`${path} opens for everyone except the System Admin, who has no staff file`, () => {
      for (const role of ALL) expect(isAllowedPath(path, role, false), `${role} on ${path}`).toBe(role !== 'SYSTEM_ADMIN');
    });
  }
  it('opens for a department head too (a head can be a witness)', () => {
    expect(isAllowedPath('/app/conduct/witness/abc', 'WAITER', true)).toBe(true);
  });
});

describe('route gate: the Conduct desk (Segment 5)', () => {
  for (const path of ['/app/workforce/conduct', '/app/workforce/conduct/abc', '/app/workforce/conduct/abc/document']) {
    it(`${path} opens for the Branch Manager, Store Manager, HR and the Director only`, () => {
      for (const role of ALL) expect(isAllowedPath(path, role, false), `${role} on ${path}`).toBe(DESK.includes(role));
      expect(isAllowedPath(path, 'WAITER', true), 'a department head sees nothing of the desk').toBe(false);
      expect(isAllowedPath(path, 'ACCOUNTANT', false), 'the Accountant has no discipline.read').toBe(false);
    });
  }
});
