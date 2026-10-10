import { describe, expect, it } from 'vitest';

import type { Capability } from '@/features/inventory';
import { isAllowedPath } from '@/lib/route-access';
import type { AppRole } from '@/types/auth';
import { NAV_ROWS, activeFor, isBareRoute, navFor, usesAppShell, usesDesktopShell, type NavContext, type NavGroup, type NavRow } from './nav-table';

const ROLES: AppRole[] = ['WAITER', 'CHEF', 'BARISTA', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY', 'MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'HR_MANAGER', 'SYSTEM_ADMIN', 'STEWARD', 'HOUSEKEEPING', 'STORE_MANAGER', 'STORE_ATTENDANT'];

const holds =
  (...caps: Capability[]) =>
  (c: Capability): boolean =>
    caps.includes(c);

const READ_ALL = holds('catalog.read', 'catalog.see_costs', 'restock.read', 'suppliers.read', 'payables.read', 'orders.read', 'prep.read', 'prep.read_flags', 'audit.read', 'requisitions.read', 'departments.read');
const EVERYTHING = (): boolean => true;
const BRANCHES = [
  { id: 'b-town', name: 'Nyeri Town' },
  { id: 'b-highway', name: 'Nyeri Highway' },
];

const ctxFor = (role: AppRole, over: Partial<NavContext> = {}): NavContext => ({ role, isDepartmentHead: false, can: READ_ALL, creditAccounts: true, branches: BRANCHES, ...over });

const links = (groups: NavGroup[]) => groups.flatMap((g) => g.items);
const keys = (groups: NavGroup[]): string[] => links(groups).map((i) => i.key);
const hrefs = (groups: NavGroup[]): string[] => links(groups).flatMap((i) => (i.subItems ? i.subItems.map((s) => s.href) : [i.href]));
const groupKeys = (groups: NavGroup[]): string[] => groups.map((g) => g.key);
const item = (groups: NavGroup[], key: string) => links(groups).find((i) => i.key === key);

describe('the navigation table never widens access', () => {
  // The route gate (middleware) is the authority. If a row ever shows a link the gate would bounce, this fails.
  for (const role of ROLES) {
    for (const [isDepartmentHead, isDepartmentMember] of [[false, false], [true, false], [false, true]] as const) {
      for (const [capsName, can] of [['no capabilities', holds()], ['read-all', READ_ALL], ['every capability', EVERYTHING]] as const) {
        it(`${role}${isDepartmentHead ? ' (department head)' : ''}${isDepartmentMember ? ' (department member)' : ''} with ${capsName}: every link opens`, () => {
          const groups = navFor(ctxFor(role, { isDepartmentHead, isDepartmentMember, can }));
          for (const href of hrefs(groups)) {
            expect(isAllowedPath(href, role, isDepartmentHead), `${role} sees ${href} but the route gate would bounce them`).toBe(true);
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
  });

  it('shows nothing without a signed-in role', () => {
    expect(navFor({ ...ctxFor('MANAGER'), role: undefined })).toEqual([]);
  });
});

describe('every desktop role keeps every link it had before', () => {
  const had: Partial<Record<AppRole, string[]>> = {
    SYSTEM_ADMIN: ['/app/admin', '/app/admin/menu', '/app/admin/house-accounts', '/app/admin/corporate-accounts', '/app/inbox', '/app/profile', '/app/inventory/catalog'],
    ACCOUNTANT: ['/app/accountant', '/app/accountant/reconciliation', '/app/other-income/history', '/app/payslips', '/app/accountant/credit', '/app/inbox', '/app/hr/my-leave', '/app/profile', '/app/inventory/catalog'],
    DIRECTOR: [
      '/app/director',
      '/app/director/analytics',
      '/app/inbox',
      '/app/director/branches/b-town',
      '/app/director/branches/b-highway',
      '/app/director/other-income',
      '/app/director/incidents',
      '/app/admin/discounts',
      '/app/director/settings',
      '/app/hr/payroll',
      '/app/director/corporate-accounts',
      '/app/director/outstanding-balances',
      '/app/manage/my-tab',
      '/app/profile',
      '/app/inventory/catalog',
    ],
    MANAGER: [
      '/app/manage/dashboard',
      '/app/orders',
      '/app/history',
      '/app/manage/reports',
      '/app/inbox',
      '/app/manage/staff',
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
    HR_MANAGER: ['/app/hr', '/app/hr/staff', '/app/hr/contract-types', '/app/hr/leave', '/app/hr/leave/calendar', '/app/hr/attendance', '/app/hr/shifts', '/app/hr/payroll', '/app/inbox', '/app/profile'],
    STORE_MANAGER: ['/app/inventory/receiving', '/app/inventory/purchasing', '/app/inventory/prep', '/app/inventory/requisitions', '/app/inventory/suppliers', '/app/inventory/catalog', '/app/inventory/audit-log', '/app/inventory/settings'],
  };
  for (const [role, expected] of Object.entries(had) as Array<[AppRole, string[]]>) {
    it(`${role}`, () => {
      const open = hrefs(navFor(ctxFor(role)));
      for (const href of expected) expect(open, `${role} lost ${href}`).toContain(href);
    });
  }

  it('gives a department head the department links on top of their own role', () => {
    const groups = navFor(ctxFor('CHEF', { isDepartmentHead: true }));
    expect(hrefs(groups)).toEqual(expect.arrayContaining(['/app/department/shifts', '/app/requisitions']));
    expect(hrefs(navFor(ctxFor('CHEF')))).not.toContain('/app/department/shifts');
  });

  it('puts the Director\'s branches in their own group, after Overview, one link per branch', () => {
    const groups = navFor(ctxFor('DIRECTOR'));
    expect(groupKeys(groups).slice(0, 2)).toEqual(['dir-overview', 'dir-branches']);
    expect(groups[1]?.items.map((i) => i.label)).toEqual(['Nyeri Town', 'Nyeri Highway']);
    expect(groupKeys(navFor(ctxFor('DIRECTOR', { branches: [] })))).not.toContain('dir-branches');
  });

  it('ends every role with the Account group', () => {
    for (const role of ['MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'SYSTEM_ADMIN', 'HR_MANAGER'] as AppRole[]) {
      expect(groupKeys(navFor(ctxFor(role))).at(-1), role).toBe('account');
    }
  });
});

describe('the Central Store rows (ported from the old Central Store sidebar tree)', () => {
  const hub = (groups: NavGroup[]) => groups.filter((g) => g.key === 'central-store' || g.key === 'procurement');

  it('gives the Store Manager every destination, with Restock levels as the last branch under Stock & counts', () => {
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
      expect(keys(groups), role).toEqual(['receiving', 'purchasing', 'prep', ...requisitions, 'stock-counts', 'suppliers', 'catalog', 'audit-log']);
      // The old-flow stock screens are not theirs until Stock & counts is rebuilt: only Restock levels branches off.
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

  it('keeps the Store Attendant to the catalog, Counts and Waste (the page shows them Pick a section, never the desktop count)', () => {
    const groups = hub(navFor(ctxFor('STORE_ATTENDANT', { can: holds('catalog.read', 'suppliers.read_basic', 'orders.request', 'orders.receive', 'prep.read', 'prep.record', 'counts.record', 'waste.read', 'waste.log') })));
    expect(keys(groups)).toEqual(['receiving', 'purchasing', 'prep', 'dispatch', 'stock-counts', 'catalog']);
    const stock = item(groups, 'stock-counts');
    expect(stock?.subItems?.map((s) => s.key)).toEqual(['counts', 'waste']);
    expect(stock?.subItems?.find((s) => s.key === 'counts')?.href).toBe('/app/inventory/stock/counts');
    expect(stock?.subItems?.find((s) => s.key === 'waste')?.href).toBe('/app/inventory/stock/waste');
  });

  it('gives every desktop role the rebuilt Stock & counts links they may read, and the Director and Accountant no write links', () => {
    for (const role of ['ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'SYSTEM_ADMIN'] as AppRole[]) {
      const stock = item(hub(navFor(ctxFor(role, { can: holds('stock.read', 'counts.read', 'waste.read', 'restock.read') }))), 'stock-counts');
      expect(stock?.subItems?.map((s) => s.key), role).toEqual(['overview', 'items', 'counts', 'waste', 'ledger', 'restock-levels']);
      expect(stock?.href, role).toBe('/app/inventory/stock');
    }
  });

  it('points every Stock & counts sub-link at a rebuilt page: Daily count and Spot count are gone', () => {
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

  it('points all three Prep sub-links at rebuilt pages (History moved from oldHref to newHref in Prep slice 4)', () => {
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
    expect(groupKeys(groups)).toContain('adm-admin');
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
    expect(activeFor(director, '/app/director/branches/b-town/orders').activeKey).toBe('director-branch-b-town');
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

  it('puts Departments under Branch Settings for the Director and under Manage for the Branch Manager', () => {
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
  });

  it('lights nothing for a page with no row (the shell still frames it)', () => {
    expect(activeFor(director, '/app/orders/new').activeKey).toBe('');
  });
});

describe('where the shell applies', () => {
  it('leaves print documents bare', () => {
    expect(isBareRoute('/app/inventory/purchasing-print/abc')).toBe(true);
    expect(isBareRoute('/app/branch/day-print/abc')).toBe(true);
    expect(isBareRoute('/app/inventory/purchasing/abc')).toBe(false);
  });

  it('puts the desktop roles and the Store Attendant in the one shell at every width (a menu drawer on phones)', () => {
    for (const role of ['MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN', 'ACCOUNTANT', 'HR_MANAGER', 'STORE_MANAGER', 'STORE_ATTENDANT'] as AppRole[]) {
      expect(usesAppShell(role), role).toBe(true);
      expect(usesDesktopShell(role, false), role).toBe(true);
    }
  });

  it('puts a department member in the one shell whatever their floor role, and gives them Deliveries and History', () => {
    for (const role of ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING'] as AppRole[]) {
      expect(usesAppShell(role, false, true), role).toBe(true);
      expect(usesDesktopShell(role, false, false, true), role).toBe(true);
      const groups = navFor(ctxFor(role, { isDepartmentMember: true }));
      expect(item(groups, 'member-deliveries')?.href, role).toBe('/app/deliveries');
      expect(item(groups, 'member-history')?.href, role).toBe('/app/deliveries/history');
      expect(item(groups, 'member-waste')?.href, role).toBe('/app/waste');
      // one History for a member (the deliveries one), not two
      expect(links(groups).filter((i) => i.label === 'History').map((i) => i.key), role).toEqual(['member-history']);
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

  it('leaves floor staff who belong to no department on the bottom tabs, with the sidebar only in the desktop preview', () => {
    for (const role of ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING'] as AppRole[]) expect(usesAppShell(role), role).toBe(false);
    expect(usesDesktopShell('WAITER', false)).toBe(false);
    expect(usesDesktopShell('WAITER', true)).toBe(true);
    expect(usesDesktopShell('STEWARD', true)).toBe(false);
    expect(usesDesktopShell('KITCHEN_DISPLAY', true)).toBe(false);
  });
});

describe('Branch waste rows (Block 3, Paper W6 and W8)', () => {
  const WASTE = '/app/inventory/branch-waste';

  it('gives the Branch Manager Branch › Waste below Requisitions and Day, once the table grants read', () => {
    const groups = navFor(ctxFor('MANAGER', { can: holds('branch_waste.read', 'branch_day.read') }));
    const branch = groups.find((g) => g.key === 'mgr-branch');
    expect(branch?.items.map((i) => i.label)).toEqual(['Requisitions', 'Day', 'Waste']);
    expect(item(groups, 'branch-waste')?.href).toBe(WASTE);
    expect(keys(navFor(ctxFor('MANAGER', { can: holds() })))).not.toContain('branch-waste');
  });

  it('gives Director, Accountant, Store Manager and System Admin Branches › Waste, read only, once the table grants read-any-branch', () => {
    for (const role of ['DIRECTOR', 'ACCOUNTANT', 'STORE_MANAGER', 'SYSTEM_ADMIN'] as AppRole[]) {
      const groups = navFor(ctxFor(role, { can: holds('branch_waste.read_any_branch') }));
      expect(hrefs(groups), role).toContain(WASTE);
      expect(keys(navFor(ctxFor(role, { can: holds() }))), role).not.toEqual(expect.arrayContaining(['director-waste']));
      expect(hrefs(navFor(ctxFor(role, { can: holds() }))), role).not.toContain(WASTE);
    }
    expect(groupKeys(navFor(ctxFor('DIRECTOR', { can: holds('branch_waste.read_any_branch') }))).slice(0, 2)).toEqual(['dir-overview', 'dir-branches']);
  });

  it('shows no Branch waste row to floor staff, the Attendant or HR', () => {
    for (const role of ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING', 'STORE_ATTENDANT', 'HR_MANAGER'] as AppRole[]) {
      expect(hrefs(navFor(ctxFor(role, { can: EVERYTHING }))), role).not.toContain(WASTE);
    }
  });
});

describe('Branch day rows (Block 4, Paper B5 to B16)', () => {
  const TODAY = '/app/branch/day';
  const HUB_TODAY = '/app/inventory/branch-day';

  it('gives the Branch Manager Day with Today and History, Today lit on Today and on a department\'s figures, History on the day file', () => {
    const groups = navFor(ctxFor('MANAGER', { can: holds('branch_day.read') }));
    const day = item(groups, 'branch-day');
    expect(day?.subItems?.map((s) => [s.label, s.href])).toEqual([
      ['Today', TODAY],
      ['History', `${TODAY}/history`],
    ]);
    expect(activeFor(groups, TODAY).activeSubKey).toBe('today');
    expect(activeFor(groups, `${TODAY}/figures`).activeSubKey).toBe('today');
    expect(activeFor(groups, `${TODAY}/history`).activeSubKey).toBe('history');
    expect(activeFor(groups, `${TODAY}/file/abc`).activeSubKey).toBe('history');
    expect(keys(navFor(ctxFor('MANAGER', { can: holds() })))).not.toContain('branch-day');
  });

  it('gives the roles without a branch of their own Branches › Day, read only, once the table grants read-any-branch', () => {
    for (const role of ['DIRECTOR', 'ACCOUNTANT', 'STORE_MANAGER', 'SYSTEM_ADMIN'] as AppRole[]) {
      const groups = navFor(ctxFor(role, { can: holds('branch_day.read_any_branch') }));
      expect(hrefs(groups), role).toContain(HUB_TODAY);
      expect(hrefs(navFor(ctxFor(role, { can: holds() }))), role).not.toContain(HUB_TODAY);
      // The route gate lets each of them in, and the Branch Manager's pages stay the Branch Manager's.
      expect(isAllowedPath(HUB_TODAY, role, false), role).toBe(true);
      expect(isAllowedPath(`${HUB_TODAY}/figures`, role, false), role).toBe(true);
    }
  });

  it('shows no Day row to floor staff, the Attendant or HR, and the gate keeps them out of the hub pages', () => {
    for (const role of ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING', 'STORE_ATTENDANT', 'HR_MANAGER'] as AppRole[]) {
      const all = hrefs(navFor(ctxFor(role, { can: EVERYTHING })));
      expect(all, role).not.toContain(HUB_TODAY);
      expect(all, role).not.toContain(TODAY);
      expect(isAllowedPath(HUB_TODAY, role, false), role).toBe(false);
    }
  });
});
