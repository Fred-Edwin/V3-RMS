import { describe, expect, it } from 'vitest';

import type { AppRole } from '@/types/auth';
import { NAV_ROWS, activeFor, menuFor, menuGroups, navFor, type NavContext } from './nav-table';
import { EVERYTHING, FLOOR, ctxFor } from './nav-test-helpers';

/** The menu as Paper 2.1 to 2.7 draws it: Home, one row per feature split by small captions, personal items under the name. */

const ON: Partial<NavContext> = { can: EVERYTHING, attendanceOn: true, payrollOn: true };

/** `Feature → [caption → [labels]]`, so a test reads like the frame. */
function shape(role: AppRole, over: Partial<NavContext> = ON): Record<string, Record<string, string[]>> {
  const out: Record<string, Record<string, string[]>> = {};
  for (const feature of menuFor(ctxFor(role, over)).features) {
    const captions: Record<string, string[]> = {};
    let caption = '';
    for (const sub of feature.subItems ?? []) {
      caption = sub.section ?? caption;
      (captions[caption] ??= []).push(sub.label);
    }
    out[feature.label] = captions;
  }
  return out;
}

const names = (role: AppRole, over: Partial<NavContext> = ON) => Object.keys(shape(role, over));
const account = (role: AppRole, over: Partial<NavContext> = ON) => menuFor(ctxFor(role, over)).account.map((a) => a.label);

describe('the menu: Home on top, feature rows below, personal items under the name', () => {
  it('opens every human role with the one Home row, which is Workforce Home', () => {
    for (const role of ['HR_MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'STORE_MANAGER', 'SYSTEM_ADMIN', 'STORE_ATTENDANT', ...FLOOR] as AppRole[]) {
      const { top } = menuFor(ctxFor(role, ON));
      expect(top.map((t) => [t.label, t.href]), role).toEqual([['Home', '/app/workforce']]);
    }
  });

  it('gives HR Workforce split into Staff, Time, Pay and Setup, and Audit log under Company', () => {
    const hr = shape('HR_MANAGER');
    expect(Object.keys(hr)).toEqual(['Workforce', 'Company']);
    expect(hr['Workforce']).toEqual({
      '': ['Overview'],
      Staff: ['Employees', 'Organisation', 'Conduct'],
      Time: ['Shifts', 'Today board', 'Timesheets', 'Leave'],
      Pay: ['Payroll'],
      Setup: ['Rules'],
    });
    expect(hr['Company']).toEqual({ '': ['Audit log'] });
    expect(account('HR_MANAGER')).toEqual(['My file', 'My leave', 'My payslips', 'Activity on my record', 'My notices']);
  });

  it('gives the Director every feature row, in the order Workforce, Inventory, Operations, Company', () => {
    expect(names('DIRECTOR')).toEqual(['Workforce', 'Inventory', 'Operations', 'Company']);
    expect(shape('DIRECTOR')['Workforce']?.['Time']).toEqual(['Shifts', 'Today board', 'Timesheets', 'Leave', 'Casual pay']);
    expect(shape('DIRECTOR')['Company']?.['']).toEqual(expect.arrayContaining(['Audit log', 'Analytics']));
  });

  it('gives the Accountant Employees, Payroll and Rules in Workforce, and no People, Time pages', () => {
    expect(shape('ACCOUNTANT')['Workforce']).toEqual({ '': ['Overview'], Staff: ['Employees'], Pay: ['Payroll'], Setup: ['Rules'] });
    expect(account('ACCOUNTANT')).toContain('My time');
  });

  it('shows the Branch Manager and the Store Manager no Pay caption', () => {
    for (const role of ['MANAGER', 'STORE_MANAGER'] as AppRole[]) {
      const wf = shape(role)['Workforce'] ?? {};
      expect(Object.keys(wf), role).toEqual(['', 'Staff', 'Time', 'Setup']);
      expect(wf['Time'], role).toContain('Casual pay');
    }
  });

  it('gives the System Admin Home and Company only, which holds the alerts, the clock switch and the admin pages', () => {
    expect(names('SYSTEM_ADMIN')).toEqual(['Company']);
    const company = shape('SYSTEM_ADMIN')['Company']?.[''] ?? [];
    expect(company).toEqual(expect.arrayContaining(['Security alerts', 'Audit log', 'Users', 'Branches', 'Menu items']));
    expect(account('SYSTEM_ADMIN')).toEqual([]);
  });

  it('lets a System Admin who previews a Central Store role keep that role’s Inventory rows', () => {
    const preview = names('SYSTEM_ADMIN', { ...ON, hubRole: 'STORE_ATTENDANT' });
    expect(preview).toContain('Inventory');
  });

  it('gives the Store Attendant Inventory and the personal items, with no Workforce row', () => {
    expect(names('STORE_ATTENDANT')).toEqual(['Inventory']);
    expect(account('STORE_ATTENDANT')).toEqual(expect.arrayContaining(['My file', 'My time', 'My leave', 'My payslips']));
  });

  it('names the floor person’s work row for the department', () => {
    expect(names('WAITER')).toEqual(['Service']);
    expect(names('CHEF')).toEqual(['Kitchen']);
    expect(names('BARISTA')).toEqual(['Barista']);
    expect(names('STEWARD')).toEqual(['Steward']);
    expect(names('HOUSEKEEPING')).toEqual(['Housekeeping']);
  });

  it('gives a department head a Department row after the work row, opening with Overview', () => {
    const waiter = shape('WAITER', { ...ON, isDepartmentHead: true });
    expect(Object.keys(waiter)).toEqual(['Service', 'Department']);
    expect(waiter['Department']?.['']).toEqual(['Overview', 'Shifts', 'Team today', 'Casual pay']);
    // A head without the new clock sees no Shifts or Team today.
    expect(shape('WAITER', { can: EVERYTHING, isDepartmentHead: true })['Department']?.['']).toEqual(['Overview', 'Casual pay']);
    // A member who is not the head has no Department row.
    expect(names('WAITER', { ...ON, isDepartmentMember: true })).toEqual(['Service']);
  });

  it('keeps the old My shifts and My leave pages among the personal items only while the new clock is off', () => {
    expect(account('WAITER', { can: EVERYTHING })).toEqual(['My file', 'My payslips', 'My shifts', 'My leave']);
    expect(account('WAITER')).toEqual(['My file', 'My time', 'My rota', 'My requests', 'My leave', 'My payslips', 'Activity on my record', 'My notices']);
  });

  it('shows a closed feature row’s links by the flags: Payroll only once Payroll has a month, the clock rows only where the clock is on', () => {
    const pay = (over: Partial<NavContext>) => shape('HR_MANAGER', { can: EVERYTHING, ...over })['Workforce'] ?? {};
    expect(pay({ attendanceOn: true, payrollOn: true })['Pay']).toEqual(['Payroll']);
    expect(pay({ attendanceOn: true, payrollOn: false })['Pay']).toBeUndefined();
    expect(pay({ attendanceOn: true, payrollOn: false })['Time']).toEqual(['Shifts', 'Today board', 'Timesheets', 'Leave']);
    expect(pay({})['Time']).toBeUndefined();
    expect(pay({})['Staff']).toEqual(['Employees', 'Organisation']);
  });

  it('puts the attention badges on the links that open each decision, and never one badge twice for a role', () => {
    const badge = (key: string, sub: string) => NAV_ROWS.find((r) => r.key === key)?.subItems?.find((s) => s.key === sub)?.badge;
    expect(badge('feature-workforce', 'timesheets')).toBe('workforce-timesheets');
    expect(badge('feature-workforce', 'leave')).toBe('workforce-leave');
    expect(badge('feature-workforce', 'conduct')).toBe('workforce-conduct');
    expect(badge('feature-workforce', 'payroll')).toBe('workforce-payroll');
    expect(NAV_ROWS.find((r) => r.key === 'wf-security')?.badge).toBe('workforce-security');
    for (const role of ['HR_MANAGER', 'MANAGER', 'STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR', 'SYSTEM_ADMIN'] as AppRole[]) {
      const seen = menuFor(ctxFor(role, ON)).features
        .flatMap((f) => [f.badge, ...(f.subItems ?? []).map((s) => s.badge)])
        .filter((b): b is NonNullable<typeof b> => b !== undefined && b.startsWith('workforce-'));
      expect(new Set(seen).size, `${role} sees ${seen.join(', ')}`).toBe(seen.length);
    }
  });

  it('lights Overview on /app/workforce and gives the page one top bar', () => {
    const groups = menuGroups(menuFor(ctxFor('HR_MANAGER', ON)));
    expect(activeFor(groups, '/app/workforce')).toMatchObject({ activeKey: 'feature-workforce', activeSubKey: 'overview', framed: true });
    // A head without a Workforce row for the page still gets the single bar.
    const head = navFor(ctxFor('CHEF', { isDepartmentHead: true, can: EVERYTHING }));
    expect(activeFor(head, '/app/workforce').framed).toBe(true);
  });
});
