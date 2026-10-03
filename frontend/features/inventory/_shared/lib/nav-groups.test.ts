import { describe, expect, it } from 'vitest';

import type { Capability } from './capabilities';
import { navGroupsFor } from './nav-groups';

const holds =
  (...caps: Capability[]) =>
  (c: Capability): boolean =>
    caps.includes(c);

type Groups = ReturnType<typeof navGroupsFor>;
const keys = (groups: Groups): string[] => groups.flatMap((g) => g.items.map((i) => i.key));
const item = (groups: Groups, key: string) => groups.flatMap((g) => g.items).find((i) => i.key === key);

const READ_ALL = holds('catalog.read', 'catalog.see_costs', 'restock.read', 'suppliers.read', 'payables.read', 'audit.read');

describe('the Central Store sidebar tree', () => {
  it('gives the Store Manager every destination, with Restock levels as the last branch under Stock & counts', () => {
    const everything = holds('catalog.read', 'restock.read', 'suppliers.read', 'audit.read');
    const groups = navGroupsFor('STORE_MANAGER', everything);
    expect(keys(groups)).toEqual(['receiving', 'purchasing', 'prep', 'dispatch', 'stock-counts', 'suppliers', 'catalog', 'audit-log', 'settings']);
    expect(item(groups, 'stock-counts')?.subItems?.map((s) => s.key)).toEqual(['overview', 'items', 'daily-count', 'spot-count', 'ledger', 'restock-levels']);
  });

  it('hides Dashboard and Reports (no design yet) and has no Supplier AP', () => {
    const all = navGroupsFor('STORE_MANAGER', READ_ALL).flatMap((g) => g.items.map((i) => i.label));
    for (const gone of ['Dashboard', 'Reports', 'Supplier AP']) expect(all).not.toContain(gone);
  });

  it('gives the other desktop roles the same tree, cut to what they may open today, and a way back to their dashboard', () => {
    for (const role of ['ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'SYSTEM_ADMIN']) {
      const groups = navGroupsFor(role, READ_ALL);
      expect(keys(groups), role).toEqual(['home', 'stock-counts', 'suppliers', 'catalog', 'audit-log']);
      expect(groups[0]?.items[0]?.href, role).toMatch(/^\/app\//);
      // The old-flow stock screens are not theirs until Stock & counts is rebuilt: only Restock levels branches off.
      expect(item(groups, 'stock-counts')?.subItems?.map((s) => s.key), role).toEqual(['restock-levels']);
    }
  });

  it('opens the first branch from a parent, so a role with one working branch lands on it', () => {
    const groups = navGroupsFor('MANAGER', READ_ALL);
    expect(item(groups, 'stock-counts')?.href).toBe('/app/inventory/stock/restock-levels');
    expect(item(navGroupsFor('STORE_MANAGER', READ_ALL), 'stock-counts')?.href).toBe('/app/inventory/stock');
  });

  it('shows nothing the person has no capability for, and drops a parent with no branch left', () => {
    expect(keys(navGroupsFor('MANAGER', holds('catalog.read')))).toEqual(['home', 'catalog']);
    expect(keys(navGroupsFor('MANAGER', holds()))).toEqual(['home']);
  });

  it('keeps the Store Attendant to the catalog and the blind count', () => {
    const groups = navGroupsFor('STORE_ATTENDANT', holds('catalog.read', 'suppliers.read_basic'));
    expect(keys(groups)).toEqual(['receiving', 'prep', 'dispatch', 'stock-counts', 'catalog']);
    const stock = item(groups, 'stock-counts');
    expect(stock?.subItems?.map((s) => s.key)).toEqual(['overview', 'daily-count']);
    expect(stock?.subItems?.find((s) => s.key === 'daily-count')?.href).toBe('/app/inventory/stock/daily-count');
  });

  it('shows nothing before the permissions arrive, apart from the way back', () => {
    expect(keys(navGroupsFor('ACCOUNTANT', holds()))).toEqual(['home']);
  });
});
