import { describe, expect, it } from 'vitest';
import { pageFor, referenceFor } from './page-for';

describe('who a page is for (the refusal screen)', () => {
  const NOW = new Date('2026-10-22T09:00:00Z');

  it('names the roles whose row holds the capability, in a fixed order, from the access table', () => {
    const payroll = pageFor('/app/workforce/payroll', 'u1', NOW);
    expect(payroll.page).toBe('Payroll');
    expect(payroll.roles).toEqual(['HR_MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'SYSTEM_ADMIN']);
    expect(payroll.forWords).toBe('HR, the Director, the Accountant and the System Admin');
  });

  it('says a Branch Manager page is for the managers who run a place', () => {
    expect(pageFor('/app/workforce/timesheets/month', 'u1', NOW).roles).toContain('MANAGER');
    expect(pageFor('/app/workforce/security', 'u1', NOW).roles).toEqual(['DIRECTOR', 'SYSTEM_ADMIN']);
  });

  it('calls a personal page the person’s own, not a list of roles', () => {
    const mine = pageFor('/app/workforce/my-payslips', 'u1', NOW);
    expect(mine.forWords).toBe('the person it belongs to');
    expect(mine.roles).toEqual([]);
  });

  it('gives a page that is not listed the plain line with no "for"', () => {
    const other = pageFor('/app/somewhere/else', 'u1', NOW);
    expect(other.forWords).toBeNull();
    expect(other.reference).toMatch(/^WF-[A-Z2-9]{4}$/);
  });

  it('makes the same reference for the same moment and a different one for another person', () => {
    expect(referenceFor('/a', 'u1', NOW)).toBe(referenceFor('/a', 'u1', new Date('2026-10-22T09:00:30Z')));
    expect(referenceFor('/a', 'u1', NOW)).not.toBe(referenceFor('/a', 'u2', NOW));
  });
});
