import { describe, expect, it } from 'vitest';

import { isAllowedPath } from '@/lib/route-access';
import type { AppRole } from '@/types/auth';
import { NAV_ROWS, activeFor, menuFor, navFor, type NavGroup, type NavRow } from './nav-table';
import { EVERYTHING, READ_ALL, ROLES, ctxFor, groupKeys, hrefs, holds, item, keys } from './nav-test-helpers';

describe('the navigation table never widens access', () => {
  // The route gate (middleware) is the authority. If a row ever shows a link the gate would bounce, this fails. The menu the person sees
  // (`menuFor`) is built from the same rows, so it is checked as well as the plain groups.
  for (const role of ROLES) {
    for (const [isDepartmentHead, isDepartmentMember] of [[false, false], [true, false], [false, true]] as const) {
      for (const [capsName, can] of [['no capabilities', holds()], ['read-all', READ_ALL], ['every capability', EVERYTHING]] as const) {
        it(`${role}${isDepartmentHead ? ' (department head)' : ''}${isDepartmentMember ? ' (department member)' : ''} with ${capsName}: every link opens`, () => {
          for (const [attendanceOn, payrollOn] of [[false, false], [true, false], [true, true]] as const) {
            const ctx = ctxFor(role, { isDepartmentHead, isDepartmentMember, can, attendanceOn, payrollOn });
            for (const href of hrefs(navFor(ctx))) {
              expect(isAllowedPath(href, role, isDepartmentHead), `${role} sees ${href} but the route gate would bounce them`).toBe(true);
            }
            const menu = menuFor(ctx);
            const menuLinks = [...menu.top, ...menu.features, ...menu.account];
            for (const link of menuLinks) {
              for (const href of link.subItems ? link.subItems.map((s) => s.href) : [link.href]) {
                expect(isAllowedPath(href, role, isDepartmentHead), `${role}'s menu shows ${href} (${link.label}) but the route gate would bounce them`).toBe(true);
              }
            }
          }
        });
      }
    }
  }

  it('shows the credit links only when the credit feature is on', () => {
    const on = hrefs(navFor(ctxFor('MANAGER', { creditAccounts: true })));
    const off = hrefs(navFor(ctxFor('MANAGER', { creditAccounts: false })));
    for (const credit of ['/app/manage/customer-credit', '/app/manage/outstanding-balances', '/app/manage/my-tab']) {
      expect(on).toContain(credit);
      expect(off).not.toContain(credit);
    }
  });

  it('shows no row to the display-only roles, which have no desktop sidebar', () => {
    expect(navFor(ctxFor('KITCHEN_DISPLAY'))).toEqual([]);
    expect(navFor(ctxFor('BARISTA_DISPLAY'))).toEqual([]);
    expect(menuFor(ctxFor('KITCHEN_DISPLAY')).features).toEqual([]);
  });

  it('shows nothing without a signed-in role', () => {
    expect(navFor({ ...ctxFor('MANAGER'), role: undefined })).toEqual([]);
    expect(menuFor({ ...ctxFor('MANAGER'), role: undefined })).toEqual({ top: [], features: [], account: [] });
  });
});

describe('every desktop role keeps every link it still has a page for', () => {
  const had: Partial<Record<AppRole, string[]>> = {
    SYSTEM_ADMIN: ['/app/admin?view=users', '/app/admin?view=branches', '/app/admin/menu', '/app/admin/house-accounts', '/app/admin/corporate-accounts', '/app/profile', '/app/inventory/catalog'],
    ACCOUNTANT: ['/app/accountant', '/app/accountant/reconciliation', '/app/other-income/history', '/app/accountant/credit', '/app/inbox', '/app/profile', '/app/inventory/catalog'],
    DIRECTOR: ['/app/director', '/app/director/analytics', '/app/inbox', '/app/director/other-income', '/app/director/incidents', '/app/admin/discounts', '/app/director/settings', '/app/hr/payroll', '/app/director/corporate-accounts', '/app/director/outstanding-balances', '/app/manage/my-tab', '/app/profile', '/app/inventory/catalog'],
    MANAGER: [
      '/app/manage/dashboard',
      '/app/orders',
      '/app/history',
      '/app/manage/reports',
      '/app/inbox',
      '/app/manage/department-settings',
      '/app/manage/menu',
      '/app/manage/shifts',
      '/app/manage/delivery-zones',
      '/app/manage/payslips',
      '/app/manage/customer-credit',
      '/app/manage/outstanding-balances',
      '/app/manage/my-tab',
      '/app/other-income/new',
      '/app/other-income/history',
      '/app/manage/incidents',
      '/app/profile',
      '/app/inventory/catalog',
    ],
    HR_MANAGER: ['/app/workforce', '/app/workforce/employees', '/app/workforce/organisation', '/app/workforce/rules', '/app/workforce/my-payslips', '/app/profile'],
    STORE_MANAGER: ['/app/inventory/receiving', '/app/inventory/purchasing', '/app/inventory/prep', '/app/inventory/requisitions', '/app/inventory/suppliers', '/app/inventory/catalog', '/app/inventory/audit-log', '/app/inventory/settings'],
  };
  for (const [role, expected] of Object.entries(had) as Array<[AppRole, string[]]>) {
    it(`${role}`, () => {
      const open = hrefs(navFor(ctxFor(role)));
      for (const href of expected) expect(open, `${role} lost ${href}`).toContain(href);
    });
  }

  it('has dropped the old HR group, the HR and System Admin Inbox rows and the old My Payments page (batch 2A)', () => {
    const hr = hrefs(navFor(ctxFor('HR_MANAGER')));
    for (const gone of ['/app/hr', '/app/hr/contract-types', '/app/hr/leave', '/app/hr/leave/calendar', '/app/inbox']) expect(hr, gone).not.toContain(gone);
    expect(hrefs(navFor(ctxFor('SYSTEM_ADMIN')))).not.toContain('/app/inbox');
    expect(hrefs(navFor(ctxFor('ACCOUNTANT')))).not.toContain('/app/payslips');
  });

  it('gives a department head the department links on top of their own role', () => {
    const groups = navFor(ctxFor('CHEF', { isDepartmentHead: true }));
    expect(hrefs(groups)).toEqual(expect.arrayContaining(['/app/department/shifts', '/app/requisitions']));
    expect(hrefs(navFor(ctxFor('CHEF')))).not.toContain('/app/department/shifts');
  });

  it('puts the Director\'s Branch day and Waste under Operations, read only, once the table grants read-any-branch', () => {
    const can = holds('branch_day.read_any_branch', 'branch_waste.read_any_branch');
    const operations = menuFor(ctxFor('DIRECTOR', { can })).features.find((f) => f.label === 'Operations');
    const subs = operations?.subItems?.filter((s) => s.section === 'Branch day' || s.section === 'Branches').map((s) => `${s.section}/${s.label}`);
    expect(subs).toEqual(['Branch day/Today', 'Branch day/History', 'Branches/Waste']);
    expect(groupKeys(navFor(ctxFor('DIRECTOR', { can: holds() })))).not.toContain('dir-branches');
  });

  it('gives every desktop role the personal items under the name, ending with Profile', () => {
    for (const role of ['MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'SYSTEM_ADMIN', 'HR_MANAGER'] as AppRole[]) {
      const account = menuFor(ctxFor(role)).account.map((a) => a.label);
      expect(account.at(-1), role).toBe('Profile');
    }
  });
});

describe('changing one row swaps a link from old to new, and nothing else', () => {
  it('moves only that row\'s href and its framing', () => {
    const before = navFor(ctxFor('ACCOUNTANT'));
    const rebuilt: NavRow[] = NAV_ROWS.map((row) => (row.key === 'accountant-reconciliation' ? { ...row, oldHref: undefined, newHref: '/app/accountant/reconciliation-v2' } : row));
    const after = navFor(ctxFor('ACCOUNTANT'), rebuilt);

    expect(item(before, 'accountant-reconciliation')).toMatchObject({ href: '/app/accountant/reconciliation', framed: false });
    expect(item(after, 'accountant-reconciliation')).toMatchObject({ href: '/app/accountant/reconciliation-v2', framed: true });

    // Every other link, its group and its order are exactly as they were.
    const rest = (groups: NavGroup[]) => groups.map((g) => ({ ...g, items: g.items.filter((i) => i.key !== 'accountant-reconciliation').map(({ key, href, framed }) => ({ key, href, framed })) }));
    expect(rest(after)).toEqual(rest(before));
  });
});

describe('which row the current page lights', () => {
  const director = navFor(ctxFor('DIRECTOR'));
  const storeManager = navFor(ctxFor('STORE_MANAGER', { can: EVERYTHING }));

  it('takes the longest matching row, so a deeper page beats the dashboard that prefixes it', () => {
    expect(activeFor(director, '/app/director').activeKey).toBe('director-dashboard');
    expect(activeFor(director, '/app/director/analytics').activeKey).toBe('director-analytics');
  });

  it('lights Overview for a stock page without a link of its own, and the exact sub-link otherwise', () => {
    expect(activeFor(storeManager, '/app/inventory/stock')).toMatchObject({ activeKey: 'stock-counts', activeSubKey: 'overview' });
    expect(activeFor(storeManager, '/app/inventory/stock/ledger/abc')).toMatchObject({ activeKey: 'stock-counts', activeSubKey: 'ledger' });
    expect(activeFor(storeManager, '/app/inventory/stock/restock-levels')).toMatchObject({ activeSubKey: 'restock-levels', framed: true });
  });

  it('lights Dispatch for the Attendant on the pack screens and the dispatch file', () => {
    const attendant = navFor(ctxFor('STORE_ATTENDANT', { can: EVERYTHING }));
    expect(activeFor(attendant, '/app/inventory/dispatch/pack/42/review').activeKey).toBe('dispatch');
    expect(activeFor(attendant, '/app/inventory/dispatch/42').activeKey).toBe('dispatch');
  });

  it('gives the Branch Manager one Requisitions row (Queue, Discrepancies, History) and no Deliveries row', () => {
    const groups = navFor(ctxFor('MANAGER', { can: EVERYTHING }));
    expect(item(groups, 'branch-requisitions')?.subItems?.map((s) => s.href)).toEqual(['/app/branch/requisitions', '/app/branch/requisitions/discrepancies', '/app/branch/requisitions/history']);
    expect(keys(groups)).not.toContain('branch-deliveries');
    expect(activeFor(groups, '/app/branch/requisitions/some-id')).toMatchObject({ activeKey: 'branch-requisitions', activeSubKey: 'queue' });
    expect(activeFor(groups, '/app/branch/requisitions/history')).toMatchObject({ activeSubKey: 'history' });
  });

  it('puts Departments under Branches for the Director and under Manage for the Branch Manager', () => {
    const dir = navFor(ctxFor('DIRECTOR', { can: EVERYTHING }));
    expect(item(dir, 'director-settings')?.subItems?.map((s) => s.href)).toEqual(['/app/director/settings', '/app/director/settings/departments']);
    expect(hrefs(navFor(ctxFor('MANAGER', { can: EVERYTHING })))).toContain('/app/manage/department-settings');
  });

  it('keeps Dispatch for the Attendant only; hub desktop roles get one Requisitions row instead', () => {
    for (const role of ['STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR', 'SYSTEM_ADMIN'] as AppRole[]) {
      const groups = navFor(ctxFor(role, { can: EVERYTHING }));
      expect(keys(groups), role).toContain('requisitions');
      expect(keys(groups), role).not.toContain('dispatch');
    }
    expect(keys(navFor(ctxFor('STORE_ATTENDANT', { can: EVERYTHING })))).toContain('dispatch');
  });

  it('says whether the page draws its own top bar: old pages do not, rebuilt screens do', () => {
    expect(activeFor(director, '/app/director/incidents').framed).toBe(false);
    expect(activeFor(storeManager, '/app/inventory/catalog').framed).toBe(true);
    // A screen reached from a row but without a row of its own, inside the self-framed areas.
    expect(activeFor(storeManager, '/app/inventory/restock-levels').framed).toBe(true);
    expect(activeFor(director, '/app/profile').framed).toBe(false);
    // My file has no row but draws its own bar for every role, so a login without a Workforce menu is not given a second one.
    expect(activeFor([], '/app/workforce/my-file').framed).toBe(true);
  });

  it('lights nothing for a page with no row (the shell still frames it)', () => {
    expect(activeFor(director, '/app/orders/new').activeKey).toBe('');
  });
});
