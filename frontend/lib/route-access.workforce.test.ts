import { describe, expect, it } from 'vitest';

import type { AppRole } from '@/types/auth';
import { isAllowedPath } from './route-access';

const ALL: AppRole[] = ['WAITER', 'CHEF', 'BARISTA', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY', 'MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'HR_MANAGER', 'SYSTEM_ADMIN', 'STEWARD', 'HOUSEKEEPING', 'STORE_MANAGER', 'STORE_ATTENDANT'];
const WORKFORCE_DESKTOP: AppRole[] = ['HR_MANAGER', 'MANAGER', 'STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR'];

describe('route gate: /app/workforce (Chapter 1 frame)', () => {
  for (const path of ['/app/workforce/waiting']) {
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

  it('opens Organisation and a department only for HR, the Branch Manager, the Store Manager and the Director (the roles the access table gives org.read)', () => {
    const OPENS: AppRole[] = ['HR_MANAGER', 'MANAGER', 'STORE_MANAGER', 'DIRECTOR'];
    for (const path of ['/app/workforce/organisation', '/app/workforce/organisation/abc']) {
      for (const role of ALL) expect(isAllowedPath(path, role, false), `${role} on ${path}`).toBe(OPENS.includes(role));
    }
    expect(isAllowedPath('/app/workforce/organisationx', 'HR_MANAGER', false)).toBe(true); // falls under the general Workforce rule, which only the five desktop roles pass
    expect(isAllowedPath('/app/workforce/organisationx', 'WAITER', false)).toBe(false);
  });

  it('opens the Home for floor staff and department heads (their clock card), and nothing else under Workforce', () => {
    for (const role of ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING', 'STORE_ATTENDANT'] as AppRole[]) {
      expect(isAllowedPath('/app/workforce', role, false), `${role} on Home`).toBe(true);
      expect(isAllowedPath('/app/workforce/waiting', role, false), `${role} on waiting`).toBe(false);
      expect(isAllowedPath('/app/workforce/employees/abc', role, false), `${role} on a file`).toBe(false);
    }
    expect(isAllowedPath('/app/workforce', 'WAITER', true)).toBe(true);
    expect(isAllowedPath('/app/workforce/waiting', 'WAITER', true)).toBe(false);
    // Segment 6a: the System Admin has a Home (its one card is Needs you) and the Security alerts page, but no other Workforce page.
    expect(isAllowedPath('/app/workforce', 'SYSTEM_ADMIN', false)).toBe(true);
    expect(isAllowedPath('/app/workforce/security', 'SYSTEM_ADMIN', false)).toBe(true);
    expect(isAllowedPath('/app/workforce/employees', 'SYSTEM_ADMIN', false)).toBe(false);
    for (const role of ['HR_MANAGER', 'MANAGER', 'STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR', 'WAITER', 'STORE_ATTENDANT'] as AppRole[]) {
      expect(isAllowedPath('/app/workforce/security', role, false), `${role} on Security alerts`).toBe(false);
    }
    // My phones is every signed-in person's own page.
    for (const role of ['HR_MANAGER', 'WAITER', 'STORE_ATTENDANT', 'SYSTEM_ADMIN'] as AppRole[]) expect(isAllowedPath('/app/workforce/my-phones', role, false), role).toBe(true);
  });

  it('opens the Today board for the roles that read it and a head, and the switch for the System Admin only', () => {
    const READS: AppRole[] = ['HR_MANAGER', 'MANAGER', 'STORE_MANAGER', 'DIRECTOR'];
    for (const role of ALL) {
      expect(isAllowedPath('/app/workforce/today', role, false), `${role} on today`).toBe(READS.includes(role));
      expect(isAllowedPath('/app/workforce/today', role, true), `head ${role} on today`).toBe(true);
      expect(isAllowedPath('/app/workforce/attendance/switch', role, false), `${role} on the switch`).toBe(role === 'SYSTEM_ADMIN');
      expect(isAllowedPath('/app/workforce/attendance/switch', role, true), `head ${role} on the switch`).toBe(role === 'SYSTEM_ADMIN');
    }
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

  it('opens Timesheets, a person’s month and Requests for the roles that read timesheets, and not for a department head or anyone else (slice 4a, 1A)', () => {
    for (const path of ['/app/workforce/timesheets', '/app/workforce/timesheets/month/2026-09/abc', '/app/workforce/requests']) {
      for (const role of ALL) {
        expect(isAllowedPath(path, role, false), `${role} on ${path}`).toBe(WORKFORCE_DESKTOP.includes(role));
        expect(isAllowedPath(path, role, true), `head ${role} on ${path}`).toBe(WORKFORCE_DESKTOP.includes(role));
      }
    }
    expect(isAllowedPath('/app/workforce/timesheetsx', 'WAITER', false)).toBe(false);
  });

  it('opens Rules, its history and Who edits what for the roles that hold rules.read (the five desktop roles and the System Admin), and no head or floor staff (segment 1B)', () => {
    const READS: AppRole[] = [...WORKFORCE_DESKTOP, 'SYSTEM_ADMIN'];
    for (const path of ['/app/workforce/rules', '/app/workforce/rules/history', '/app/workforce/rules/who-edits-what']) {
      for (const role of ALL) expect(isAllowedPath(path, role, false), `${role} on ${path}`).toBe(READS.includes(role));
      expect(isAllowedPath(path, 'WAITER', true), `a head on ${path}`).toBe(false);
    }
  });

  it('opens My time, My rota, Report a problem and My requests for everyone who has a clock, and never for the System Admin (slice 4a)', () => {
    for (const path of ['/app/workforce/my-time', '/app/workforce/my-time/rota', '/app/workforce/my-time/report', '/app/workforce/my-time/requests']) {
      for (const role of ALL) expect(isAllowedPath(path, role, false), `${role} on ${path}`).toBe(role !== 'SYSTEM_ADMIN');
    }
    // A path that only starts with the same letters falls to the general Workforce rule: the five desktop roles only.
    expect(isAllowedPath('/app/workforce/my-timex', 'WAITER', false)).toBe(false);
  });
});
