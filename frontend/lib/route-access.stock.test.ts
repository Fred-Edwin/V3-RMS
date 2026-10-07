import { describe, expect, it } from 'vitest';
import type { AppRole } from '@/types/auth';
import { isAllowedPath } from './route-access';

const DESKTOP: AppRole[] = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER'];
const ok = (path: string, role: AppRole) => isAllowedPath(path, role, false);

describe('route gate: Stock, Counting and Waste', () => {
  it.each(DESKTOP)('lets %s open every Stock, Counting and Waste page', (role) => {
    for (const path of [
      '/app/inventory/stock',
      '/app/inventory/stock/items',
      '/app/inventory/stock/ledger',
      '/app/inventory/stock/ledger/abc',
      '/app/inventory/stock/counts',
      '/app/inventory/stock/counts/new',
      '/app/inventory/stock/counts/abc/count',
      '/app/inventory/stock/counts/setup',
      '/app/inventory/stock/waste',
      '/app/inventory/stock/waste/new',
      '/app/inventory/count-print/abc',
      '/app/inventory/count-print/blank',
    ]) {
      expect(ok(path, role), `${role} ${path}`).toBe(true);
    }
  });

  it('gives the Store Attendant the counts, the waste pages and the blank sheet only', () => {
    for (const path of ['/app/inventory/stock/counts', '/app/inventory/stock/counts/abc/count', '/app/inventory/stock/waste', '/app/inventory/stock/waste/new', '/app/inventory/count-print/blank']) {
      expect(ok(path, 'STORE_ATTENDANT'), path).toBe(true);
    }
    for (const path of ['/app/inventory/stock/items', '/app/inventory/stock/ledger', '/app/inventory/stock/ledger/abc', '/app/inventory/count-print/abc', '/app/inventory/stock/countsfoo']) {
      expect(ok(path, 'STORE_ATTENDANT'), path).toBe(false);
    }
  });

  it('keeps floor staff out', () => {
    for (const role of ['WAITER', 'CHEF', 'BARISTA'] as AppRole[]) expect(ok('/app/inventory/stock/counts', role), role).toBe(false);
  });

  it('leaves Restock levels as it was: desktop roles only', () => {
    expect(ok('/app/inventory/stock/restock-levels', 'STORE_ATTENDANT')).toBe(false);
    expect(ok('/app/inventory/stock/restock-levels', 'STORE_MANAGER')).toBe(true);
  });
});
