import { describe, expect, it } from 'vitest';

import type { AppRole } from '@/types/auth';
import { NAV_ROWS, activeFor, navFor, type NavGroup } from '../nav-table';
import { EVERYTHING, ctxFor, holds, item, keys } from './nav-test-helpers';

describe('the Central Store rows (ported from the old Central Store sidebar tree)', () => {
  const hub = (groups: NavGroup[]) => groups.filter((g) => g.key === 'central-store' || g.key === 'procurement');

  it('gives the Store Manager every destination, with Restock levels as the last branch under Stock and counts', () => {
    const groups = hub(navFor(ctxFor('STORE_MANAGER', { can: EVERYTHING })));
    expect(keys(groups)).toEqual(['receiving', 'purchasing', 'prep', 'requisitions', 'stock-counts', 'suppliers', 'catalog', 'audit-log', 'carriers', 'inventory-settings']);
    expect(item(groups, 'requisitions')?.subItems?.map((s) => s.key)).toEqual(['queue', 'discrepancies', 'history']);
    expect(item(groups, 'stock-counts')?.subItems?.map((s) => s.key)).toEqual(['overview', 'items', 'counts', 'waste', 'ledger', 'restock-levels']);
  });

  it('gives the other desktop roles the same tree, cut to what they may open today', () => {
    for (const role of ['ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'SYSTEM_ADMIN'] as AppRole[]) {
      const groups = hub(navFor(ctxFor(role)));
      // The Branch Manager's Requisitions row is in the Branch group, so only the four hub roles get one here.
      const requisitions = role === 'MANAGER' ? [] : ['requisitions'];
      // The Branch Manager's Stock audit log is the 'branch-audit-log' row in the Branch group (the same screen), so they get one link, not two.
      const auditLog = role === 'MANAGER' ? [] : ['audit-log'];
      expect(keys(groups), role).toEqual(['receiving', 'purchasing', 'prep', ...requisitions, 'stock-counts', 'suppliers', 'catalog', ...auditLog]);
      // The old-flow stock screens are not theirs until Stock and counts is rebuilt: only Restock levels branches off.
      expect(item(groups, 'stock-counts')?.subItems?.map((s) => s.key), role).toEqual(['restock-levels']);
    }
  });

  it('gives every desktop role the three Prep sub-links, read-only roles included (prep.read opens them)', () => {
    for (const role of ['ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'SYSTEM_ADMIN'] as AppRole[]) {
      const prep = item(hub(navFor(ctxFor(role, { can: holds('prep.read', 'prep.see_costs', 'prep.read_flags') }))), 'prep');
      expect(prep?.subItems?.map((s) => s.key), role).toEqual(['runs', 'usual-recipes', 'history']);
    }
  });

  it('opens the first branch from a parent, so a role with one working branch lands on it', () => {
    expect(item(navFor(ctxFor('MANAGER')), 'stock-counts')?.href).toBe('/app/inventory/stock/restock-levels');
    expect(item(navFor(ctxFor('STORE_MANAGER', { can: EVERYTHING })), 'stock-counts')?.href).toBe('/app/inventory/stock');
  });

  it('shows nothing the person has no capability for, and drops a parent with no branch left', () => {
    expect(keys(hub(navFor(ctxFor('MANAGER', { can: holds('catalog.read') }))))).toEqual(['catalog']);
    expect(keys(hub(navFor(ctxFor('MANAGER', { can: holds() }))))).toEqual([]);
  });

  it('gives the Store Attendant the six Purchasing sub-links with their badges, and everyone else the plain link', () => {
    const attendant = hub(navFor(ctxFor('STORE_ATTENDANT', { can: holds('orders.read', 'orders.request') })));
    const purchasing = item(attendant, 'purchasing');
    expect(purchasing?.subItems?.map((s) => [s.label, s.href, s.badge])).toEqual([
      ['Home', '/app/inventory/purchasing', undefined],
      ['Restock list', '/app/inventory/purchasing/restock', 'purchasing-restock'],
      ['New order', '/app/inventory/purchasing/new', undefined],
      ['My orders', '/app/inventory/purchasing/my-orders', 'purchasing-my-orders'],
      ['History', '/app/inventory/purchasing/history', undefined],
      ['Restock levels', '/app/inventory/purchasing/levels', undefined],
    ]);
    expect(item(hub(navFor(ctxFor('STORE_ATTENDANT', { can: holds('orders.read', 'orders.receive') }))), 'receiving')?.badge).toBe('purchasing-receiving');
    const manager = item(hub(navFor(ctxFor('STORE_MANAGER', { can: holds('orders.read', 'orders.approve') }))), 'purchasing');
    expect(manager?.subItems).toBeUndefined();
    expect(manager?.href).toBe('/app/inventory/purchasing');
  });

  it('keeps the Store Attendant to the catalog, Counts and Waste (the page shows them Pick a section, never the desktop count)', () => {
    const groups = hub(navFor(ctxFor('STORE_ATTENDANT', { can: holds('catalog.read', 'suppliers.read_basic', 'orders.request', 'orders.receive', 'prep.read', 'prep.record', 'counts.record', 'waste.read', 'waste.log') })));
    expect(keys(groups)).toEqual(['receiving', 'purchasing', 'prep', 'dispatch', 'stock-counts', 'catalog']);
    const stock = item(groups, 'stock-counts');
    expect(stock?.subItems?.map((s) => s.key)).toEqual(['counts', 'waste']);
    expect(stock?.subItems?.find((s) => s.key === 'counts')?.href).toBe('/app/inventory/stock/counts');
    expect(stock?.subItems?.find((s) => s.key === 'waste')?.href).toBe('/app/inventory/stock/waste');
  });

  it('gives every desktop role the rebuilt Stock and counts links they may read', () => {
    for (const role of ['ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'SYSTEM_ADMIN'] as AppRole[]) {
      const stock = item(hub(navFor(ctxFor(role, { can: holds('stock.read', 'counts.read', 'waste.read', 'restock.read') }))), 'stock-counts');
      expect(stock?.subItems?.map((s) => s.key), role).toEqual(['overview', 'items', 'counts', 'waste', 'ledger', 'restock-levels']);
      expect(stock?.href, role).toBe('/app/inventory/stock');
    }
  });

  it('points every Stock and counts sub-link at a rebuilt page: Daily count and Spot count are gone', () => {
    const stockRow = NAV_ROWS.find((row) => row.key === 'stock-counts');
    expect(stockRow?.subItems?.map((s) => s.key)).not.toContain('daily-count');
    expect(stockRow?.subItems?.map((s) => s.key)).not.toContain('spot-count');
    for (const sub of stockRow?.subItems ?? []) {
      expect(sub.oldHref, sub.key).toBeUndefined();
      expect(sub.newHref, sub.key).toMatch(/^\/app\/inventory\/stock/);
    }
  });

  it('gives Prep three sub-links, Runs, Usual recipes and History, to the Store Manager and the Attendant alike', () => {
    for (const role of ['STORE_MANAGER', 'STORE_ATTENDANT'] as AppRole[]) {
      const prep = item(hub(navFor(ctxFor(role, { can: EVERYTHING }))), 'prep');
      expect(prep?.subItems?.map((s) => s.key), role).toEqual(['runs', 'usual-recipes', 'history']);
      expect(prep?.href, role).toBe('/app/inventory/prep');
    }
  });

  it('points all three Prep sub-links at rebuilt pages', () => {
    const prepRow = NAV_ROWS.find((row) => row.key === 'prep');
    for (const sub of prepRow?.subItems ?? []) {
      expect(sub.oldHref, sub.key).toBeUndefined();
      expect(sub.framed, sub.key).toBeUndefined();
      expect(sub.newHref, sub.key).toMatch(/^\/app\/inventory\/prep/);
    }
    expect(prepRow?.subItems?.find((s) => s.key === 'history')?.newHref).toBe('/app/inventory/prep/history');
  });

  it('puts the Needs a look badge on Prep and Runs only for someone holding prep.read_flags', () => {
    const withFlags = item(hub(navFor(ctxFor('STORE_MANAGER', { can: holds('prep.read', 'prep.read_flags') }))), 'prep');
    expect(withFlags?.badge).toBe('prep-needs-look');
    expect(withFlags?.subItems?.find((s) => s.key === 'runs')?.badge).toBe('prep-needs-look');
    expect(withFlags?.subItems?.find((s) => s.key === 'history')?.badge).toBeUndefined();

    const without = item(hub(navFor(ctxFor('STORE_ATTENDANT', { can: holds('prep.read', 'prep.record') }))), 'prep');
    expect(without?.badge).toBeUndefined();
    expect(without?.subItems?.every((s) => s.badge === undefined)).toBe(true);
  });

  it('lights the right Prep sub-link: Runs on the runs page, History on the history page', () => {
    const groups = navFor(ctxFor('STORE_MANAGER', { can: EVERYTHING }));
    expect(activeFor(groups, '/app/inventory/prep')).toMatchObject({ activeKey: 'prep', activeSubKey: 'runs' });
    expect(activeFor(groups, '/app/inventory/prep/some-run-id')).toMatchObject({ activeKey: 'prep', activeSubKey: 'runs' });
    expect(activeFor(groups, '/app/inventory/prep/history')).toMatchObject({ activeKey: 'prep', activeSubKey: 'history' });
    expect(activeFor(groups, '/app/inventory/prep/recipes')).toMatchObject({ activeKey: 'prep', activeSubKey: 'usual-recipes' });
  });

  it('shows the Central Store rows by the previewed role while a System Admin previews, and the rest by their real role', () => {
    const groups = navFor(ctxFor('SYSTEM_ADMIN', { hubRole: 'STORE_ATTENDANT', can: holds('catalog.read', 'prep.read', 'counts.record', 'waste.read') }));
    expect(keys(hub(groups))).toEqual(['prep', 'dispatch', 'stock-counts', 'catalog']);
    expect(keys(groups)).toContain('admin-users');
  });
});
