import { describe, expect, it } from 'vitest';

import type { AppRole } from '@/types/auth';
import { isAllowedPath } from './route-access';

const ALL: AppRole[] = ['WAITER', 'CHEF', 'BARISTA', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY', 'MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'HR_MANAGER', 'SYSTEM_ADMIN', 'STEWARD', 'HOUSEKEEPING', 'STORE_MANAGER', 'STORE_ATTENDANT'];
const WORKFORCE_DESKTOP: AppRole[] = ['HR_MANAGER', 'MANAGER', 'STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR'];

describe('route gate: /app/workforce (Chapter 1 frame)', () => {
  for (const path of ['/app/workforce', '/app/workforce/waiting']) {
    it(`${path} opens for the five desktop Workforce roles and nobody else`, () => {
      for (const role of ALL) {
        expect(isAllowedPath(path, role, false), `${role} on ${path}`).toBe(WORKFORCE_DESKTOP.includes(role));
      }
    });
  }

  it('does not let a department head in because of the head marker alone', () => {
    expect(isAllowedPath('/app/workforce', 'WAITER', true)).toBe(false);
  });

  it('does not match a path that only starts with the same letters', () => {
    expect(isAllowedPath('/app/workforcex', 'HR_MANAGER', false)).toBe(false);
  });
});
