import { describe, expect, it } from 'vitest';

import { isAllowedPath } from '@/lib/route-access';
import type { AppRole } from '@/types/auth';
import { isBareRoute, navFor, quickLinksFor, showsBottomBar, usesAppShell, usesDesktopShell, type NavContext } from './nav-table';
import { EVERYTHING, FLOOR, ctxFor, hrefs, item, keys, links } from './nav-test-helpers';

describe('where the shell applies', () => {
  it('leaves print documents bare', () => {
    expect(isBareRoute('/app/inventory/purchasing-print/abc')).toBe(true);
    expect(isBareRoute('/app/branch/day-print/abc')).toBe(true);
    expect(isBareRoute('/app/inventory/purchasing/abc')).toBe(false);
    expect(isBareRoute('/app/workforce/schedule/rota/print')).toBe(true);
    expect(isBareRoute('/app/workforce/schedule/rota')).toBe(false);
  });

  it('puts the desktop roles and the Store Attendant in the one shell at every width (a menu drawer on phones)', () => {
    for (const role of ['MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN', 'ACCOUNTANT', 'HR_MANAGER', 'STORE_MANAGER', 'STORE_ATTENDANT'] as AppRole[]) {
      expect(usesAppShell(role), role).toBe(true);
      expect(usesDesktopShell(role, false), role).toBe(true);
    }
  });

  it('keeps the floor staff\'s own pages in the sidebar, for every waiter whatever their department', () => {
    for (const [isDepartmentHead, isDepartmentMember] of [[false, false], [true, false], [false, true]] as const) {
      const waiter = navFor(ctxFor('WAITER', { isDepartmentHead, isDepartmentMember }));
      for (const [key, href] of [['staff-order-history', '/app/history'], ['staff-leave', '/app/hr/my-leave'], ['me-payslips', '/app/workforce/my-payslips'], ['staff-performance', '/app/performance']]) {
        expect(item(waiter, key)?.href, `waiter head=${isDepartmentHead} member=${isDepartmentMember} ${key}`).toBe(href);
      }
    }
    for (const role of ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING'] as AppRole[]) {
      expect(item(navFor(ctxFor(role)), 'staff-leave')?.href, role).toBe('/app/hr/my-leave');
    }
    // sidebar only: neither returned link takes a bottom-bar slot
    const quick = quickLinksFor(navFor(ctxFor('WAITER'))).map((i) => i.key);
    expect(quick).not.toContain('staff-order-history');
    expect(quick).not.toContain('staff-leave');
  });

  it('puts a department member in the one shell whatever their floor role, and gives them Deliveries and Delivery history', () => {
    for (const role of ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING'] as AppRole[]) {
      expect(usesAppShell(role, false, true), role).toBe(true);
      expect(usesDesktopShell(role, false, false, true), role).toBe(true);
      const groups = navFor(ctxFor(role, { isDepartmentMember: true }));
      expect(item(groups, 'member-deliveries')?.href, role).toBe('/app/deliveries');
      expect(item(groups, 'member-history')?.href, role).toBe('/app/deliveries/history');
      expect(item(groups, 'member-waste')?.href, role).toBe('/app/waste');
      // one deliveries history for a member, not two
      expect(links(groups).filter((i) => i.label === 'Delivery history').map((i) => i.key), role).toEqual(['member-history']);
      // a member is not a head: no requisitions, no department shifts
      expect(keys(groups), role).not.toEqual(expect.arrayContaining(['department-requisitions']));
    }
    // a head never gets the member rows (their own Deliveries row serves them)
    const head = navFor(ctxFor('CHEF', { isDepartmentHead: true, isDepartmentMember: true }));
    expect(keys(head)).not.toContain('member-deliveries');
    expect(keys(head)).not.toContain('member-waste');
    expect(item(head, 'department-waste')?.href).toBe('/app/waste');
    expect(keys(head)).toContain('department-deliveries');
  });

  it('puts floor staff in the one shell whether or not they belong to a department', () => {
    for (const role of FLOOR) {
      expect(usesAppShell(role), role).toBe(true);
      expect(usesDesktopShell(role, false), role).toBe(true);
    }
    expect(usesAppShell('KITCHEN_DISPLAY')).toBe(false);
    expect(usesDesktopShell('KITCHEN_DISPLAY', true)).toBe(false);
  });
});

describe('the phone bottom bar for floor staff (Paper "Floor staff bottom bar", 12 Oct)', () => {
  const labels = (role: AppRole, over: Partial<NavContext>): string[] => quickLinksFor(navFor(ctxFor(role, over))).map((l) => l.label);
  const MEMBER: Partial<NavContext> = { isDepartmentMember: true };
  const HEAD: Partial<NavContext> = { isDepartmentHead: true };

  it('gives a waiter in a department New order, Orders, Deliveries and Inbox', () => {
    expect(labels('WAITER', MEMBER)).toEqual(['New order', 'Orders', 'Deliveries', 'Inbox']);
    expect(labels('WAITER', HEAD)).toEqual(['New order', 'Orders', 'Deliveries', 'Inbox']);
  });

  it('gives a chef or barista their station, Daily count, Deliveries and Inbox', () => {
    expect(labels('CHEF', MEMBER)).toEqual(['Kitchen', 'Daily count', 'Deliveries', 'Inbox']);
    expect(labels('CHEF', HEAD)).toEqual(['Kitchen', 'Daily count', 'Deliveries', 'Inbox']);
    expect(labels('BARISTA', MEMBER)).toEqual(['Barista', 'Daily count', 'Deliveries', 'Inbox']);
  });

  it('gives a steward or housekeeper Dashboard, Daily count, Deliveries and Inbox', () => {
    expect(labels('STEWARD', MEMBER)).toEqual(['Dashboard', 'Daily count', 'Deliveries', 'Inbox']);
    expect(labels('HOUSEKEEPING', MEMBER)).toEqual(['Dashboard', 'Daily count', 'Deliveries', 'Inbox']);
  });

  for (const role of FLOOR) {
    for (const [name, over] of [['member', MEMBER], ['head', HEAD]] as Array<[string, Partial<NavContext>]>) {
      it(`${role} ${name}: at most 4 links (5 slots with Menu), each one a link the drawer shows and the route gate lets in`, () => {
        const groups = navFor(ctxFor(role, over));
        const quick = quickLinksFor(groups);
        expect(quick.length).toBeGreaterThan(0);
        expect(quick.length).toBeLessThanOrEqual(4);
        expect(new Set(quick.map((l) => l.quick)).size, 'slots are unique').toBe(quick.length);
        for (const link of quick) {
          expect(hrefs(groups), `${link.label} is not in the menu`).toContain(link.href);
          expect(isAllowedPath(link.href, role, over.isDepartmentHead === true), `${role} sees ${link.href} in the bar but the route gate would bounce them`).toBe(true);
        }
      });
    }
  }

  it('shows the Deliveries count on the bar link from the same badge as the menu row', () => {
    const deliveries = quickLinksFor(navFor(ctxFor('CHEF', MEMBER))).find((l) => l.label === 'Deliveries');
    expect(deliveries?.badge).toBe('deliveries');
    expect(quickLinksFor(navFor(ctxFor('CHEF', MEMBER))).find((l) => l.label === 'Inbox')?.badge).toBe('inbox');
  });

  it('gives every desktop role no bar', () => {
    for (const role of ['MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'HR_MANAGER', 'SYSTEM_ADMIN', 'STORE_MANAGER', 'STORE_ATTENDANT'] as AppRole[]) {
      expect(quickLinksFor(navFor(ctxFor(role, { can: EVERYTHING }))), role).toEqual([]);
    }
  });

  it('shows the bar on a page the menu links to, never on a task screen or on the cart', () => {
    const groups = navFor(ctxFor('WAITER', MEMBER));
    expect(showsBottomBar(groups, '/app/orders')).toBe(true);
    expect(showsBottomBar(groups, '/app/deliveries')).toBe(true);
    expect(showsBottomBar(groups, '/app/deliveries/history')).toBe(true);
    expect(showsBottomBar(groups, '/app/orders/new')).toBe(false);
    // Workforce pages (Home, My file, My payslips) carry no order tabs.
    for (const path of ['/app/workforce', '/app/workforce/my-file', '/app/workforce/my-payslips']) expect(showsBottomBar(groups, path)).toBe(false);
    expect(showsBottomBar(groups, '/app/deliveries/d1/count')).toBe(false);
    expect(showsBottomBar(groups, '/app/day/count')).toBe(false);
    // The Daily count home has its own sticky "Check the opening" button, so the bar steps aside there.
    expect(showsBottomBar(navFor(ctxFor('CHEF', MEMBER)), '/app/day')).toBe(false);
    expect(showsBottomBar(navFor(ctxFor('CHEF', HEAD)), '/app/day')).toBe(false);
  });

  it('names the department count link Daily count and the Branch Manager’s Branch day link Branch day', () => {
    expect(labels('CHEF', MEMBER)).toContain('Daily count');
    expect(labels('CHEF', MEMBER)).not.toContain('Day');
    expect(links(navFor(ctxFor('CHEF', HEAD))).some((l) => l.label === 'Day')).toBe(false);
    expect(links(navFor(ctxFor('MANAGER', { can: EVERYTHING }))).some((l) => l.label === 'Branch day')).toBe(true);
  });
});
