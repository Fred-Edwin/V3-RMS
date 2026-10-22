import { describe, expect, it } from 'vitest';

import { isAllowedPath } from '@/lib/route-access';
import type { AppRole } from '@/types/auth';
import { activeFor, navFor } from './nav-table';
import { EVERYTHING, ctxFor, holds, hrefs, item, keys, links } from './nav-test-helpers';

describe('Branch waste rows (Block 3, Paper W6 and W8)', () => {
  const WASTE = '/app/inventory/branch-waste';

  it('gives the Branch Manager Branch › Waste below Requisitions and Branch day, once the table grants read', () => {
    const groups = navFor(ctxFor('MANAGER', { can: holds('branch_waste.read', 'branch_day.read') }));
    const branch = groups.find((g) => g.key === 'mgr-branch');
    expect(branch?.items.map((i) => i.label)).toEqual(['Requisitions', 'Branch day', 'Waste']);
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

  it('gives the Branch Manager Branch day with Today and History, Today lit on Today and on a department\'s figures, History on the day file', () => {
    const groups = navFor(ctxFor('MANAGER', { can: holds('branch_day.read') }));
    const day = item(groups, 'branch-day');
    expect(day?.label).toBe('Branch day');
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

  it('gives the roles without a branch of their own Branches › Branch day, read only, once the table grants read-any-branch', () => {
    for (const role of ['DIRECTOR', 'ACCOUNTANT', 'STORE_MANAGER', 'SYSTEM_ADMIN'] as AppRole[]) {
      const groups = navFor(ctxFor(role, { can: holds('branch_day.read_any_branch') }));
      expect(hrefs(groups), role).toContain(HUB_TODAY);
      expect(hrefs(navFor(ctxFor(role, { can: holds() }))), role).not.toContain(HUB_TODAY);
      // The route gate lets each of them in, and the Branch Manager's pages stay the Branch Manager's.
      expect(isAllowedPath(HUB_TODAY, role, false), role).toBe(true);
      expect(isAllowedPath(`${HUB_TODAY}/figures`, role, false), role).toBe(true);
    }
  });

  it('gives the roles without a branch of their own Branch day with Today and History, like the Branch Manager', () => {
    for (const role of ['DIRECTOR', 'ACCOUNTANT', 'STORE_MANAGER', 'SYSTEM_ADMIN'] as AppRole[]) {
      const groups = navFor(ctxFor(role, { can: holds('branch_day.read_any_branch') }));
      const day = links(groups).find((i) => i.label === 'Branch day' && i.subItems?.some((s) => s.href === HUB_TODAY));
      expect(day?.subItems?.map((s) => [s.label, s.href]), role).toEqual([
        ['Today', HUB_TODAY],
        ['History', `${HUB_TODAY}/history`],
      ]);
      expect(activeFor(groups, `${HUB_TODAY}/file/abc`).activeSubKey, role).toBe('history');
      expect(activeFor(groups, `${HUB_TODAY}/history`).activeSubKey, role).toBe('history');
      expect(isAllowedPath(`${HUB_TODAY}/history`, role, false), role).toBe(true);
      expect(isAllowedPath(`${HUB_TODAY}/file/abc`, role, false), role).toBe(true);
      expect(isAllowedPath('/app/inventory/day-print/abc', role, false), role).toBe(true);
    }
  });

  it('puts the blocker count on the Branch Manager’s Today only, and gives the Branch Manager a Stock audit log link in the Branch group', () => {
    const groups = navFor(ctxFor('MANAGER', { can: holds('branch_day.read', 'branch_day.close', 'audit.read') }));
    const day = item(groups, 'branch-day');
    expect(day?.subItems?.find((s) => s.key === 'today')?.badge).toBe('branch-day-todo');
    expect(day?.subItems?.find((s) => s.key === 'history')?.badge).toBeUndefined();
    expect(item(groups, 'branch-audit-log')?.href).toBe('/app/inventory/audit-log');
    expect(item(groups, 'branch-audit-log')?.label).toBe('Stock audit log');
    expect(keys(navFor(ctxFor('MANAGER', { can: holds('branch_day.read') })))).not.toContain('branch-audit-log');
  });

  it('shows no Branch day row to floor staff, the Attendant or HR, and the gate keeps them out of the hub pages', () => {
    for (const role of ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING', 'STORE_ATTENDANT', 'HR_MANAGER'] as AppRole[]) {
      const all = hrefs(navFor(ctxFor(role, { can: EVERYTHING })));
      expect(all, role).not.toContain(HUB_TODAY);
      expect(all, role).not.toContain(TODAY);
      expect(isAllowedPath(HUB_TODAY, role, false), role).toBe(false);
    }
  });
});
