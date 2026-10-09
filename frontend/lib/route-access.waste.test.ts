import { describe, expect, it } from 'vitest';
import type { AppRole } from '@/types/auth';
import { isAllowedPath } from './route-access';

const ok = (path: string, role: AppRole, head = false) => isAllowedPath(path, role, head);

describe('route gate: the department Branch waste phone screens (Block 3)', () => {
  it('opens the list and the log flow to a department head and to the floor staff', () => {
    for (const role of ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING'] as AppRole[]) {
      for (const path of ['/app/waste', '/app/waste/new']) expect(ok(path, role), `${role} ${path}`).toBe(true);
    }
    expect(ok('/app/waste', 'CHEF', true)).toBe(true);
    expect(ok('/app/waste/new', 'MANAGER', true)).toBe(true);
  });

  it('keeps it from everyone else, the Central Store roles and the desktop roles included', () => {
    for (const role of ['MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'SYSTEM_ADMIN', 'STORE_MANAGER', 'STORE_ATTENDANT'] as AppRole[]) {
      expect(ok('/app/waste', role), role).toBe(false);
    }
  });

  it('no longer reserves /app/branch/waste for heads (the old head screen is gone; the Branch Manager page is the desktop session)', () => {
    expect(ok('/app/branch/waste', 'CHEF', true)).toBe(false);
    expect(ok('/app/branch/waste', 'MANAGER')).toBe(true);
  });
});
