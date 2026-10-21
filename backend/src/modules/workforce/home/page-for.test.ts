import { describe, expect, it } from 'vitest';
import type { UserRole } from '@prisma/client';
import type { AccessSubject } from '../_shared/workforce-access';
import { pageFor, referenceFor } from './page-for';

const NOW = new Date('2026-10-22T09:00:00Z');
const who = (role: UserRole, extra: Partial<AccessSubject> = {}): AccessSubject => ({ id: 'u1', role, siteId: 's1', ...extra });

describe('who a page is for (the refusal screen)', () => {
  it('names the roles whose row holds the capability, in a fixed order, from the access table', () => {
    const payroll = pageFor('/app/workforce/payroll', who('CHEF'), NOW);
    expect(payroll.page).toBe('Payroll');
    expect(payroll.roles).toEqual(['HR_MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'SYSTEM_ADMIN']);
    expect(payroll.forWords).toBe('HR, the Director, the Accountant and the System Admin');
  });

  it('says a Branch Manager page is for the managers who run a place', () => {
    expect(pageFor('/app/workforce/timesheets/month', who('CHEF'), NOW).roles).toContain('MANAGER');
    expect(pageFor('/app/workforce/security', who('CHEF'), NOW).roles).toEqual(['DIRECTOR', 'SYSTEM_ADMIN']);
  });

  it('calls a personal page the person’s own, not a list of roles', () => {
    const mine = pageFor('/app/workforce/my-payslips', who('CHEF'), NOW);
    expect(mine.forWords).toBe('the person it belongs to');
    expect(mine.roles).toEqual([]);
  });

  it('gives a page that is not listed the plain line with no "for"', () => {
    const other = pageFor('/app/somewhere/else', who('CHEF'), NOW);
    expect(other.forWords).toBeNull();
    expect(other.reference).toMatch(/^WF-[A-Z2-9]{4}$/);
  });

  it('offers My payslips instead of Payroll to a person with a payslip, and My team instead of Employees to a head', () => {
    expect(pageFor('/app/workforce/payroll', who('CHEF'), NOW).instead).toMatchObject({ label: 'My payslips', href: '/app/workforce/my-payslips' });
    expect(pageFor('/app/workforce/employees', who('CHEF', { headOfDepartmentIds: ['d1'] }), NOW).instead).toMatchObject({ label: 'My team' });
    expect(pageFor('/app/workforce/employees', who('CHEF'), NOW).instead).toBeNull();
  });

  it('says "Overview" to the desktop roles and "Home" to staff and the System Admin', () => {
    expect(pageFor('/app/workforce/payroll', who('MANAGER'), NOW).homeLabel).toBe('Overview');
    expect(pageFor('/app/workforce/payroll', who('WAITER'), NOW).homeLabel).toBe('Home');
    expect(pageFor('/app/workforce/payroll', who('SYSTEM_ADMIN', { siteId: null }), NOW).homeLabel).toBe('Home');
  });

  it('makes the same reference for the same moment and a different one for another person', () => {
    expect(referenceFor('/a', 'u1', NOW)).toBe(referenceFor('/a', 'u1', new Date('2026-10-22T09:00:30Z')));
    expect(referenceFor('/a', 'u1', NOW)).not.toBe(referenceFor('/a', 'u2', NOW));
  });
});
