import { describe, expect, it } from 'vitest';
import type { AppRole } from '@/types/auth';
import { isAllowedPath } from './route-access';

const ok = (path: string, role: AppRole, head = false) => isAllowedPath(path, role, head);

describe('route gate: Dispatch, deliveries and discrepancies (Block 2)', () => {
  it('opens the pack screens, the Attendant tabs and the batch print to the three roles that may pack', () => {
    for (const role of ['STORE_ATTENDANT', 'STORE_MANAGER', 'SYSTEM_ADMIN'] as AppRole[]) {
      for (const path of ['/app/inventory/dispatch', '/app/inventory/dispatch/pack/abc', '/app/inventory/dispatch/pack/abc/def/', '/app/inventory/dispatch/abc', '/app/inventory/dispatch-print/batch']) {
        expect(ok(path, role), `${role} ${path}`).toBe(true);
      }
    }
  });

  it('keeps the pack screens from the roles that only read', () => {
    for (const role of ['DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'CHEF'] as AppRole[]) expect(ok('/app/inventory/dispatch/pack/abc', role), role).toBe(false);
  });

  it('lets every desktop role read the dispatch file, the discrepancy list and the carriers', () => {
    for (const role of ['STORE_MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'SYSTEM_ADMIN'] as AppRole[]) {
      for (const path of ['/app/inventory/requisitions/dispatch/abc', '/app/inventory/requisitions/discrepancies', '/app/inventory/requisitions/discrepancies/abc', '/app/inventory/carriers']) {
        expect(ok(path, role), `${role} ${path}`).toBe(true);
      }
    }
    expect(ok('/app/branch/requisitions/dispatch/abc', 'MANAGER')).toBe(true);
    expect(ok('/app/branch/requisitions/discrepancies', 'MANAGER')).toBe(true);
    expect(ok('/app/branch/dispatch-print/abc', 'STORE_ATTENDANT')).toBe(true);
  });

  it('opens the department\'s Deliveries to its head and to the floor staff, and to nobody else', () => {
    for (const role of ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING'] as AppRole[]) {
      for (const path of ['/app/deliveries', '/app/deliveries/abc', '/app/deliveries/abc/count', '/app/deliveries/abc/confirm', '/app/deliveries/abc/done', '/app/deliveries/history']) {
        expect(ok(path, role), `${role} ${path}`).toBe(true);
      }
    }
    expect(ok('/app/deliveries', 'MANAGER', true)).toBe(true);
    expect(ok('/app/deliveries', 'STORE_MANAGER')).toBe(false);
  });
});
