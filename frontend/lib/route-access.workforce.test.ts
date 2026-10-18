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

  it('opens the person’s own file for every role, and the employee file only for the desktop roles', () => {
    for (const role of ALL) {
      expect(isAllowedPath('/app/workforce/my-file', role, false), `${role} on my-file`).toBe(true);
      expect(isAllowedPath('/app/workforce/employees/abc', role, false), `${role} on a file`).toBe(WORKFORCE_DESKTOP.includes(role));
    }
  });

  it('opens Organisation and a department only for HR, the Branch Manager and the Director (the roles whose menu draws it)', () => {
    const OPENS: AppRole[] = ['HR_MANAGER', 'MANAGER', 'DIRECTOR'];
    for (const path of ['/app/workforce/organisation', '/app/workforce/organisation/abc']) {
      for (const role of ALL) expect(isAllowedPath(path, role, false), `${role} on ${path}`).toBe(OPENS.includes(role));
    }
    expect(isAllowedPath('/app/workforce/organisationx', 'HR_MANAGER', false)).toBe(true); // falls under the general Workforce rule, which only the five desktop roles pass
    expect(isAllowedPath('/app/workforce/organisationx', 'WAITER', false)).toBe(false);
  });

  it('does not let a department head in because of the head marker alone', () => {
    expect(isAllowedPath('/app/workforce', 'WAITER', true)).toBe(false);
  });

  it('opens the Rota pages for the desktop roles and for a department head, and shift templates for the desktop roles only', () => {
    for (const path of ['/app/workforce/schedule/rota', '/app/workforce/schedule/rota/print']) {
      for (const role of ALL) {
        expect(isAllowedPath(path, role, false), `${role} on ${path}`).toBe(WORKFORCE_DESKTOP.includes(role));
        expect(isAllowedPath(path, role, true), `head ${role} on ${path}`).toBe(true);
      }
    }
    for (const role of ALL) {
      expect(isAllowedPath('/app/workforce/schedule/templates', role, true), `head ${role} on templates`).toBe(WORKFORCE_DESKTOP.includes(role));
    }
    expect(isAllowedPath('/app/workforce/schedule/rotax', 'WAITER', true)).toBe(false);
  });

  it('does not match a path that only starts with the same letters', () => {
    expect(isAllowedPath('/app/workforcex', 'HR_MANAGER', false)).toBe(false);
  });
});
