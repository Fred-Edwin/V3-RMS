import { describe, expect, it } from 'vitest';

import type { Capability } from './capabilities';
import { navGroupsFor } from './nav-groups';

const holds =
  (...caps: Capability[]) =>
  (c: Capability): boolean =>
    caps.includes(c);

const keys = (groups: ReturnType<typeof navGroupsFor>): string[] => groups.flatMap((g) => g.items.map((i) => i.key));

const READ_ALL = holds('catalog.read', 'catalog.see_costs', 'restock.read', 'suppliers.read', 'payables.read', 'audit.read');

describe('the Central Store sidebar', () => {
  it('gives the Store Manager every destination, old and rebuilt', () => {
    const everything = holds('catalog.read', 'restock.read', 'suppliers.read', 'audit.read');
    expect(keys(navGroupsFor('STORE_MANAGER', everything))).toEqual([
      'dashboard',
      'receiving',
      'purchasing',
      'prep',
      'dispatch',
      'stock-counts',
      'restock-levels',
      'suppliers',
      'catalog',
      'reports',
      'audit-log',
      'settings',
    ]);
  });

  it('gives the other desktop roles the rebuilt destinations they may read, and a way back to their own dashboard', () => {
    for (const role of ['ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'SYSTEM_ADMIN']) {
      const groups = navGroupsFor(role, READ_ALL);
      expect(keys(groups), role).toEqual(['home', 'restock-levels', 'suppliers', 'catalog', 'audit-log']);
      expect(groups[0]?.items[0]?.href, role).toMatch(/^\/app\//);
    }
  });

  it('shows nothing the person has no capability for', () => {
    expect(keys(navGroupsFor('MANAGER', holds('catalog.read')))).toEqual(['home', 'catalog']);
    expect(keys(navGroupsFor('MANAGER', holds()))).toEqual(['home']);
  });

  it('keeps the Store Attendant to the catalog and the blind count', () => {
    const groups = navGroupsFor('STORE_ATTENDANT', holds('catalog.read', 'suppliers.read_basic'));
    expect(keys(groups)).toEqual(['dashboard', 'receiving', 'prep', 'dispatch', 'stock-counts', 'catalog', 'reports']);
    const stock = groups.flatMap((g) => g.items).find((i) => i.key === 'stock-counts');
    expect(stock?.subItems?.map((s) => s.key)).toEqual(['overview', 'daily-count']);
    expect(stock?.subItems?.find((s) => s.key === 'daily-count')?.href).toBe('/app/inventory/stock/daily-count');
  });

  it('shows nothing before the permissions arrive, apart from the way back', () => {
    expect(keys(navGroupsFor('ACCOUNTANT', holds()))).toEqual(['home']);
  });
});
